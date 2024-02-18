import { createRequestDebugInfo } from '@crawlee/utils';
import { Dataset, NonRetryableError, PlaywrightCrawler, log } from 'crawlee';
import { parseConfiguration } from './configuration.js';
import { crawlRoute } from './routes/crawl-route.js';
import { CrawlerState } from './types/crawler-state.js';
import { Input } from './types/input.js';
import { ERROR_TYPE } from './utils.js';

export const createCrawler = async ({ input }: { input: Input }) => {
    const config = await parseConfiguration(input);

    const { maxPagesPerCrawl, proxyConfiguration, requests } = config;

    const crawler = new PlaywrightCrawler({
        launchContext: {
            launchOptions: {
                // TODO: Just headless
                headless: true,
            },
        },
        retryOnBlocked: true,
        requestHandlerTimeoutSecs: 3 * 60,
        proxyConfiguration,
        maxRequestsPerCrawl: maxPagesPerCrawl,
        requestHandler: crawlRoute,
        preNavigationHooks: [
            async () => {
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

    const defaultCrawlerState = { pagesOpened: 0, config };
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
