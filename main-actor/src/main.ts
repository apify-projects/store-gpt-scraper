import { Actor } from 'apify';
import { PlaywrightCrawler, Dataset, log, RequestList } from 'crawlee';
import { createRequestDebugInfo } from '@crawlee/utils';
import { Input } from './input.js';
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
    shortsTextByTokenLength,
    tryToParseJsonFromString,
} from './processors.js';

// Initialize the Apify SDK
await Actor.init();

const input = await Actor.getInput() as Input;

if (!input) throw new Error('INPUT cannot be empty!');
// @ts-ignore
const openai = await getOpenAIClient(process.env.OPENAI_API_KEY, process.env.OPENAI_ORGANIZATION_ID);
const modelConfig = validateGPTModel(input.model);
const requestList = await RequestList.open('start-urls', input.startUrls);

let maxPaidDatasetItems: number | undefined;
let maxRequestsPerCrawl: number | undefined = input.maxPagesPerCrawl;

const crawler = new PlaywrightCrawler({
    launchContext: {
        launchOptions: {
            // TODO: Just headless
            headless: true,
        },
    },
    sessionPoolOptions: {
        blockedStatusCodes: [401, 429],
    },
    // Switch of blocking of resources as it breaks scraping of apify.com/store detail pages like.
    // preNavigationHooks: [
    //     async ({ blockRequests }) => {
    //         // By default blocks [".css", ".jpg", ".jpeg", ".png", ".svg", ".gif", ".woff", ".pdf", ".zip"]
    //         await blockRequests();
    //     },
    // ],
    // NOTE: GPT-4 is very slow, so we need to increase the timeout
    requestHandlerTimeoutSecs: 3 * 60,
    proxyConfiguration: input.proxyConfiguration && await Actor.createProxyConfiguration(input.proxyConfiguration),
    maxRequestsPerCrawl,
    requestList,

    async requestHandler({ request, page, enqueueLinks }) {
        const { depth = 0 } = request.userData;
        log.info(`Opening ${request.url}...`);

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
                `Page ${request.url} enqueued ${enqueuedLinks.length} new URLs.`,
                { foundLinksCount: enqueuedLinks.length, enqueuedLinksCount: enqueuedLinks.length, alreadyPresentLinksCount },
            );
        }

        // A function to be evaluated by Playwright within the browser context.
        let originalContentHtml;
        if (input.targetSelector) {
            try {
                originalContentHtml = await page.$eval(input.targetSelector, (el) => el.innerHTML);
            } catch (err) {
                log.error(`Cannot find targetSelector ${input.targetSelector} on ${request.url}, skipping this page.`, { err });
                return;
            }
        } else {
            originalContentHtml = await page.content();
        }

        const pageContent = htmlToMarkdown(originalContentHtml);
        const contentTokenLength = getNumberOfTextTokens(pageContent);
        const instructionTokenLength = getNumberOfTextTokens(input.instructions);

        let answer = '';
        const openaiUsage = new OpenaiAPIUsage(modelConfig.model);
        const contentMaxTokens = (modelConfig.maxTokens * 0.9) - instructionTokenLength; // 10% buffer for answer
        if (contentTokenLength > contentMaxTokens) {
            const truncatedContent = shortsTextByTokenLength(pageContent, contentMaxTokens);
            log.info(
                `Processing page ${request.url} with truncated text using GPT instruction...`,
                { originalContentLength: pageContent.length, contentLength: truncatedContent.length, contentMaxTokens },
            );
            log.warning(`Content was truncated for ${request.url} to match GPT maxTokens limit.`, { url: request.url, maxTokensLimit: modelConfig.maxTokens });
            const prompt = `${input.instructions}\`\`\`${truncatedContent}\`\`\``;
            log.debug(
                `Truncated content for ${request.url}`,
                { promptTokenLength: getNumberOfTextTokens(prompt), contentMaxTokens, truncatedContentLength: getNumberOfTextTokens(truncatedContent) },
            );
            try {
                const answerResult = await processInstructionsWithRetry({ prompt, openai, modelConfig, apifyClient: Actor.apifyClient });
                answer = answerResult.answer;
                openaiUsage.logApiCallUsage(answerResult.usage);
            } catch (err: any) {
                throw rethrowOpenaiError(err);
            }
        } else {
            log.info(
                `Processing page ${request.url} with GPT instruction...`,
                { contentLength: pageContent.length, contentTokenLength },
            );
            const prompt = `${input.instructions}\`\`\`${pageContent}\`\`\``;
            try {
                const answerResult = await processInstructionsWithRetry({ prompt, openai, modelConfig, apifyClient: Actor.apifyClient });
                answer = answerResult.answer;
                openaiUsage.logApiCallUsage(answerResult.usage);
            } catch (err: any) {
                throw rethrowOpenaiError(err);
            }
        }

        if (!answer) {
            log.error('No answer was returned.', { url: request.url });
            return;
        }
        const answerLowerCase = answer.toLocaleLowerCase();
        if (answerLowerCase.includes('skip this page')
            || answerLowerCase.includes('skip this url')
            || answerLowerCase.includes('skip the page')
            || answerLowerCase.includes('skip the url')
            || answerLowerCase.includes('skip url')
            || answerLowerCase.includes('skip page')
        ) {
            log.info(`Skipping page ${request.url} from output, the key word "skip this page" was found in answer.`, { answer });
            return;
        }

        log.info(`Page ${request.url} processed.`, {
            openaiUsage: openaiUsage.usage,
            usdUsage: openaiUsage.finalCostUSD,
            apiCallsCount: openaiUsage.apiCallsCount,
        });

        // Store the results
        await Dataset.pushData({
            url: request.loadedUrl,
            answer,
            jsonAnswer: tryToParseJsonFromString(answer),
            '#debug': {
                model: modelConfig.model,
                openaiUsage: openaiUsage.usage,
                usdUsage: openaiUsage.finalCostUSD,
                apiCallsCount: openaiUsage.apiCallsCount,
            },
        });
    },

    async failedRequestHandler({ request }, error: Error) {
        const errorMessage = error.message || 'no error';
        log.error(`Request ${request.url} failed and will not be retried anymore. Marking as failed.\nLast Error Message: ${errorMessage}`);
        if (error.name === 'UserFacedError') {
            await Dataset.pushData({
                url: request.loadedUrl,
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

await crawler.run();
log.info('Configuration completed. Starting the scrape.');
await crawler.run();
log.info(`Crawler finished.`);

// Exit successfully
await Actor.exit();
