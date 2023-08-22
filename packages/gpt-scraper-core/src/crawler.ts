import { Actor } from 'apify';
import { PlaywrightCrawler, Dataset, log, RequestList } from 'crawlee';
import { createRequestDebugInfo } from '@crawlee/utils';
import { AnySchema } from 'ajv';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
    processInstructionsWithRetry,
    getNumberOfTextTokens,
    getOpenAIClient,
    validateGPTModel,
    rethrowOpenaiError,
    OpenaiAPIUsage,
} from './openai.js';
import {
    htmlToMarkdown,
    maybeShortsTextByTokenLength,
} from './processors.js';
import { Input } from './input.js';

interface State {
    pageOutputted: number;
}

/**
 * Parse and validate JSON schema, if valid return it, otherwise failed actor.
 * @param schema
 */
const validateSchemaOrFail = async (schema: AnySchema | undefined): Promise<AnySchema|undefined> => {
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
    const openai = getOpenAIClient(input.openaiApiKey);
    const modelConfig = validateGPTModel(input.model);
    const requestList = await RequestList.open('start-urls', input.startUrls);

    // Validate schema
    const { useStructureOutput, schema: uncheckJsonSchema } = input;
    const schema = useStructureOutput ? await validateSchemaOrFail(uncheckJsonSchema) : undefined;

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
            const openaiUsage = new OpenaiAPIUsage(modelConfig.model);
            const contentMaxTokens = (modelConfig.maxTokens * 0.9) - instructionTokenLength; // 10% buffer for answer
            const pageContent = maybeShortsTextByTokenLength(originPageContent, contentMaxTokens);

            if (pageContent.length < originPageContent.length) {
                log.info(
                    `Processing page ${url} with truncated text using GPT instruction...`,
                    { originContentLength: originPageContent.length, contentLength: pageContent.length, contentMaxTokens },
                );
                log.warning(
                    `Content was truncated for ${url} to match GPT maxTokens limit.`,
                    { url, maxTokensLimit: modelConfig.maxTokens },
                );
            } else {
                log.info(
                    `Processing page ${url} with GPT instruction...`,
                    { contentLength: pageContent.length },
                );
            }

            try {
                const answerResult = await processInstructionsWithRetry({
                    instructions: input.instructions,
                    content: pageContent,
                    schema,
                    openai,
                    modelConfig,
                    apifyClient: Actor.apifyClient,
                });
                answer = answerResult.answer;
                jsonAnswer = answerResult.jsonAnswer;
                openaiUsage.logApiCallUsage(answerResult.usage);
            } catch (err: any) {
                throw rethrowOpenaiError(err);
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
                openaiUsage: openaiUsage.usage,
                usdUsage: openaiUsage.finalCostUSD,
                apiCallsCount: openaiUsage.apiCallsCount,
            });

            // Store the results
            await Dataset.pushData({
                url,
                answer,
                jsonAnswer,
                '#debug': {
                    model: modelConfig.model,
                    openaiUsage: openaiUsage.usage,
                    usdUsage: openaiUsage.finalCostUSD,
                    apiCallsCount: openaiUsage.apiCallsCount,
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
