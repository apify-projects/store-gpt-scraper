import { Actor } from 'apify';
import { AnySchema } from 'ajv';
import { PlaywrightCrawler, Dataset, log, RequestList, utils, KeyValueStore } from 'crawlee';
import { createRequestDebugInfo } from '@crawlee/utils';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { getModelByName } from './models/models.js';
import { tryWrapInOpenaiError } from './models/openai.js';
import { getNumberOfTextTokens, htmlToMarkdown, maybeShortsTextByTokenLength } from './processors.js';
import { Input } from './input.js';
import { OpenaiAPIError } from './errors.js';

interface State {
    pageOutputted: number;
}

/**
 * Parse and validate JSON schema, if valid return it, otherwise failed actor.
 * @param schema
 */
const validateSchemaOrFail = async (schema: AnySchema | undefined): Promise<AnySchema | undefined> => {
    if (!schema) {
        await Actor.fail('Schema is required when using "Use JSON schema to format answer" option. Provide the correct JSON schema or disable this option.');
        return;
    }
    try {
        const validator = new Ajv2020();
        addFormats(validator);
        validator.compile(schema);
        return schema;
    } catch (e: any) {
        log.error(`Schema is not valid: ${e.message}`, { error: e });
        await Actor.fail('Schema is not valid. Go to Actor run log, '
                    + 'where you can find error details or disable "Use JSON schema to format answer" option.');
    }
    return undefined;
};

export const createCrawler = async ({ input }: { input: Input }) => {
    const model = getModelByName(input.model);
    if (!model) throw await Actor.fail(`Model ${input.model} is not supported`);

    const requestList = await RequestList.open('start-urls', input.startUrls);

    // Validate schema
    const { useStructureOutput, schema: uncheckJsonSchema } = input;
    const schema = useStructureOutput ? await validateSchemaOrFail(uncheckJsonSchema) : undefined;

    if (schema && model.modelConfig.interface === 'text') {
        log.warning(`Schema is not supported for model ${model.modelConfig.modelName}! Ignoring schema.`);
    }

    const saveSnapshots = input.saveSnapshots ?? true;
    const kvStore = await KeyValueStore.open();
    const crawler = new PlaywrightCrawler({
        launchContext: {
            launchOptions: {
                // TODO: Just headless
                headless: true,
            },
        },
        retryOnBlocked: true,
        requestHandlerTimeoutSecs: 3 * 60,
        proxyConfiguration: input.proxyConfiguration && await Actor.createProxyConfiguration(input.proxyConfiguration),
        maxRequestsPerCrawl: input.maxPagesPerCrawl,
        requestList,

        async requestHandler({ request, page, enqueueLinks, closeCookieModals }) {
            const { depth = 0 } = request.userData;
            const state = await crawler.useState({ pageOutputted: 0 } as State);
            const url = request.loadedUrl || request.url;

            if (input.maxPagesPerCrawl && state.pageOutputted >= input.maxPagesPerCrawl) {
                log.info(`Reached max pages per run (${input.maxPagesPerCrawl}), skipping URL ${url}.`);
                await Actor.exit(`Finished! Reached max pages per run (${input.maxPagesPerCrawl}).`);
                return;
            }

            log.info(`Opening ${url}...`);

            await closeCookieModals();

            // Enqueue links
            // If maxCrawlingDepth is not set or 0 the depth is infinite.
            const isDepthLimitReached = !!input.maxCrawlingDepth && depth >= input.maxCrawlingDepth;
            if (input.linkSelector && input?.globs?.length && !isDepthLimitReached) {
                const { processedRequests } = await enqueueLinks({
                    selector: input.linkSelector,
                    globs: input.globs,
                    userData: {
                        depth: depth + 1,
                    },
                });
                const enqueuedLinks = processedRequests.filter(({ wasAlreadyPresent }) => !wasAlreadyPresent);
                const alreadyPresentLinksCount = processedRequests.length - enqueuedLinks.length;
                log.info(
                    `Page ${url} enqueued ${enqueuedLinks.length} new URLs.`,
                    { foundLinksCount: enqueuedLinks.length, enqueuedLinksCount: enqueuedLinks.length, alreadyPresentLinksCount },
                );
            }

            // A function to be evaluated by Playwright within the browser context.
            let originContentHtml;
            if (input.targetSelector) {
                try {
                    originContentHtml = await page.$eval(input.targetSelector, (el) => el.innerHTML);
                } catch (err) {
                    log.error(`Cannot find targetSelector ${input.targetSelector} on ${url}, skipping this page.`, { err });
                    return;
                }
            } else {
                originContentHtml = await page.content();
            }
            const originPageContent = htmlToMarkdown(originContentHtml);
            const instructionTokenLength = getNumberOfTextTokens(input.instructions);

            let answer = '';
            let jsonAnswer: null | object;
            const contentMaxTokens = model.modelConfig.maxTokens * 0.9 - instructionTokenLength; // 10% buffer for answer
            const pageContent = maybeShortsTextByTokenLength(originPageContent, contentMaxTokens);

            let snapshotKey: string | undefined;
            let sentContentKey: string | undefined;
            if (saveSnapshots) {
                snapshotKey = Date.now().toString();
                sentContentKey = `${snapshotKey}-sentContent`;
                await utils.puppeteer.saveSnapshot(page, {
                    key: snapshotKey,
                    saveHtml: true,
                    saveScreenshot: true,
                });
                await kvStore.setValue(`${sentContentKey}.md`, pageContent, {
                    contentType: 'text/markdown',
                });
            }

            if (pageContent.length < originPageContent.length) {
                log.info(
                    `Processing page ${url} with truncated text using GPT instruction...`,
                    { originContentLength: originPageContent.length, contentLength: pageContent.length, contentMaxTokens },
                );
                log.warning(
                    `Content was truncated for ${url} to match GPT maxTokens limit.`,
                    { url, maxTokensLimit: model.modelConfig.maxTokens },
                );
            } else {
                log.info(
                    `Processing page ${url} with GPT instruction...`,
                    { contentLength: pageContent.length },
                );
            }

            try {
                const answerResult = await model.processInstructionsWithRetry({
                    instructions: input.instructions,
                    content: pageContent,
                    schema,
                    apifyClient: Actor.apifyClient,
                });
                answer = answerResult.answer;
                jsonAnswer = answerResult.jsonAnswer;
                model.updateApiCallUsage(answerResult.usage);
            } catch (err: any) {
                const error = tryWrapInOpenaiError(err);
                if (error instanceof OpenaiAPIError && error.message.includes('Invalid schema')) {
                    // TODO: find a way to validate schema before running the actor
                    // see #12
                    throw await Actor.fail(error.message);
                }
                throw error;
            }

            const answerLowerCase = answer?.toLocaleLowerCase() || '';
            if (answerLowerCase.includes('skip this page')
                || answerLowerCase.includes('skip this url')
                || answerLowerCase.includes('skip the page')
                || answerLowerCase.includes('skip the url')
                || answerLowerCase.includes('skip url')
                || answerLowerCase.includes('skip page')
            ) {
                log.info(`Skipping page ${url} from output, the key word "skip this page" was found in answer.`, { answer });
                return;
            }

            if (input.maxPagesPerCrawl && state.pageOutputted >= input.maxPagesPerCrawl) {
                log.info(`Reached max pages per run (${input.maxPagesPerCrawl}), skipping URL ${url}.`);
                return;
            }

            log.info(`Page ${url} processed.`, {
                openaiUsage: model.stats.usage,
                usdUsage: model.stats.finalCostUSD,
                apiCallsCount: model.stats.apiCallsCount,
            });

            // Store the results
            await Dataset.pushData({
                url,
                answer,
                jsonAnswer,
                htmlSnapshotUrl: snapshotKey ? `https://api.apify.com/v2/key-value-stores/${kvStore.id}/records/${snapshotKey}.html` : undefined,
                screenshotUrl: snapshotKey ? `https://api.apify.com/v2/key-value-stores/${kvStore.id}/records/${snapshotKey}.jpg` : undefined,
                sentContentUrl: sentContentKey ? `https://api.apify.com/v2/key-value-stores/${kvStore.id}/records/${sentContentKey}.md` : undefined,
                '#debug': {
                    modelName: model.modelConfig.modelName,
                    openaiUsage: model.stats.usage,
                    usdUsage: model.stats.finalCostUSD,
                    apiCallsCount: model.stats.apiCallsCount,
                },
            });
            state.pageOutputted++;
        },

        async failedRequestHandler({ request }, error: Error) {
            const errorMessage = error.message || 'no error';
            const url = request.loadedUrl || request.url;
            log.error(`Request ${url} failed and will not be retried anymore. Marking as failed.\nLast Error Message: ${errorMessage}`);
            if (error.name === 'UserFacedError') {
                await Dataset.pushData({
                    url,
                    answer: `ERROR: ${errorMessage}`,
                });
                return;
            }
            await Dataset.pushData({
                '#error': true,
                '#debug': createRequestDebugInfo(request),
            });
        },
    });

    return crawler;
};
