import {
    Dataset,
    NonRetryableError,
    PlaywrightCrawler,
    PlaywrightCrawlingContext,
    createRequestDebugInfo,
    log,
} from 'crawlee';

import { initialCookiesHook } from './hooks/initial-cookies.js';
import { LABELS, router } from './routes/router.js';
import { Config } from './types/config.js';
import { CrawlerState } from './types/crawler-state.js';
import { ERROR_TYPE } from './utils.js';

export const createCrawler = async (config: Config) => {
    const { maxPagesPerCrawl, proxyConfiguration, requests } = config;

    const crawler = new PlaywrightCrawler({
        launchContext: {
            launchOptions: {
                /** We intentionally ignore these errors, because some broken websites would otherwise not be scraped */
                args: ['--ignore-certificate-errors'],
            },
        },
        /**
         * The default values scale up too quickly for larger runs, this will make the scaling more gradual.
         * - Scaling down is also set to be faster, as with playwright crawler, there are a lot of timeouts
         */
        autoscaledPoolOptions: { scaleUpStepRatio: 0.015, scaleDownStepRatio: 0.1 },
        retryOnBlocked: true,
        requestHandlerTimeoutSecs: 3 * 60,
        proxyConfiguration,
        requestHandler: router,
        preNavigationHooks: [
            initialCookiesHook,
            async (context: PlaywrightCrawlingContext) => {
                const { label } = context.request;

                const isCrawlRoute = label === LABELS.CRAWL;
                if (!isCrawlRoute) return;

                const state = await crawler.useState<CrawlerState>();
                if (state.pagesOpened >= maxPagesPerCrawl) {
                    const err = new NonRetryableError('Skipping this page');
                    err.name = ERROR_TYPE.LIMIT_ERROR;
                    throw err;
                }
            },
        ],
        postNavigationHooks: [
            async ({ page }) => {
                // see https://github.com/apify/crawlee/issues/2314
                // will solve client-side redirects through meta tags
                await page.waitForSelector('body', {
                    state: 'attached',
                    timeout: 60_000,
                });
            },
        ],

        async failedRequestHandler({ request }, error: Error) {
            if (error.name === ERROR_TYPE.LIMIT_ERROR) {
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

    const defaultCrawlerState = getInitialCrawlerState(config);
    await crawler.useState<CrawlerState>(defaultCrawlerState);

    await crawler.addRequests(requests);

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

const getInitialCrawlerState = (config: Config): CrawlerState => {
    const modelStats = {
        apiCallsCount: 0,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        usdUsage: 0,
    };

    return { config, pagesOpened: 0, modelStats };
};
