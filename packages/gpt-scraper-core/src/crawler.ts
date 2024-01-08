import { Actor } from 'apify';
import { AnySchema } from 'ajv';
import { PlaywrightCrawler, Dataset, log, RequestList, utils, KeyValueStore, NonRetryableError } from 'crawlee';
import { createRequestDebugInfo } from '@crawlee/utils';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { getModelByName } from './models/models.js';
import { getNumberOfTextTokens, htmlToMarkdown, maybeShortsTextByTokenLength, shrinkHtml } from './processors.js';
import { Input, PAGE_FORMAT } from './types/input.js';
import { parseInput, validateInput, validateInputCssSelectors } from './input.js';
import { NonRetryableOpenaiAPIError } from './errors.js';
import { OpenAIModelSettings } from './types/models.js';
import { doesUrlMatchGlobs } from './utils.js';

interface State {
    pagesOpened: number;
}
const DEFAULT_STATE: State = {
    pagesOpened: 0,
};

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
    input = await parseInput(input);
    await validateInput(input);

    const model = getModelByName(input.model);
    if (!model) throw await Actor.fail(`Model ${input.model} is not supported`);

    const requestList = await RequestList.open('start-urls', input.startUrls);

    // Validate schema
    const { useStructureOutput, schema: uncheckJsonSchema } = input;
    const schema = useStructureOutput ? await validateSchemaOrFail(uncheckJsonSchema) : undefined;

    if (schema && model.modelConfig.interface === 'text') {
        log.warning(`Schema is not supported for model ${model.modelConfig.modelName}! Ignoring schema.`);
    }

    const pageFormat = input.pageFormatInRequest || PAGE_FORMAT.MARKDOWN;
    const saveSnapshots = input.saveSnapshots ?? true;
    const kvStore = await KeyValueStore.open();

    const modelSettings: OpenAIModelSettings = {
        openAIApiKey: input.openaiApiKey,
        temperature: input.temperature,
        topP: input.topP,
        frequencyPenalty: input.frequencyPenalty,
        presencePenalty: input.presencePenalty,
    };

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
        preNavigationHooks: [
            async () => {
                const state = await crawler.useState<State>(DEFAULT_STATE);
                if (state.pagesOpened >= input.maxPagesPerCrawl) {
                    const err = new NonRetryableError('Skipping this page');
                    err.name = 'LimitError';
                    throw err;
                }
            },
        ],

        async requestHandler({ request, page, enqueueLinks, closeCookieModals }) {
            const { depth = 0 } = request.userData;
            const state = await crawler.useState<State>(DEFAULT_STATE);
            const isFirstPage = state.pagesOpened === 0;
            state.pagesOpened++;
            const url = request.loadedUrl || request.url;

            if (isFirstPage) await validateInputCssSelectors(input, page);

            log.info(`Opening ${url}...`);

            await closeCookieModals();

            // Enqueue links
            // If maxCrawlingDepth is not set or 0 the depth is infinite.
            const isDepthLimitReached = !!input.maxCrawlingDepth && depth >= input.maxCrawlingDepth;
            if (input.linkSelector && input?.includeUrlGlobs?.length && !isDepthLimitReached) {
                const { processedRequests } = await enqueueLinks({
                    selector: input.linkSelector,
                    globs: input.includeUrlGlobs,
                    exclude: input.excludeUrlGlobs,
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

            const skipGptProcessing = input.skipGptGlobs && doesUrlMatchGlobs(url, input.skipGptGlobs);
            if (skipGptProcessing) {
                log.info(`Skipping page from GPT processing because it matched 'skipGptGlobs', crawling only.`, { url });
                return;
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

            const shrunkHtml = await shrinkHtml(originContentHtml, page, input.removeElementsCssSelector);
            const originPageContent = pageFormat === PAGE_FORMAT.MARKDOWN ? htmlToMarkdown(shrunkHtml) : shrunkHtml;

            const instructionTokenLength = getNumberOfTextTokens(input.instructions);

            let answer = '';
            let jsonAnswer: null | object;
            const contentMaxTokens = model.modelConfig.maxTokens * 0.9 - instructionTokenLength; // 10% buffer for answer
            const pageContent = maybeShortsTextByTokenLength(originPageContent, contentMaxTokens);

            let snapshotKey: string | undefined;
            let sentContentKey: string | undefined;
            if (saveSnapshots) {
                snapshotKey = Date.now().toString();
                sentContentKey = `${snapshotKey}-sentContent.${pageFormat === PAGE_FORMAT.MARKDOWN ? 'md' : 'html'}`;
                await utils.puppeteer.saveSnapshot(page, {
                    key: snapshotKey,
                    saveHtml: true,
                    saveScreenshot: true,
                });
                await kvStore.setValue(sentContentKey, pageContent, {
                    contentType: pageFormat === PAGE_FORMAT.MARKDOWN ? 'text/markdown' : 'text/html',
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
                    modelSettings,
                    apifyClient: Actor.apifyClient,
                });
                answer = answerResult.answer;
                jsonAnswer = answerResult.jsonAnswer;
                model.updateApiCallUsage(answerResult.usage);
            } catch (error: any) {
                if (error instanceof NonRetryableOpenaiAPIError) {
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
                sentContentUrl: sentContentKey ? `https://api.apify.com/v2/key-value-stores/${kvStore.id}/records/${sentContentKey}` : undefined,
                '#debug': {
                    modelName: model.modelConfig.modelName,
                    openaiUsage: model.stats.usage,
                    usdUsage: model.stats.finalCostUSD,
                    apiCallsCount: model.stats.apiCallsCount,
                },
            });
        },

        async failedRequestHandler({ request }, error: Error) {
            if (error.name === 'LimitError') {
                return;
            }
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

    // @ts-expect-error patching
    const oldCrawlerLogError = crawler.log.error.bind(crawler.log);
    // @ts-expect-error patching
    crawler.log.error = (...args) => {
        try {
            if (args[0].includes('LimitError')) return;
        } catch (e) { /* empty */ }
        return oldCrawlerLogError(...args);
    };
    return crawler;
};
