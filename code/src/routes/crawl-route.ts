import { KeyValueStore, NonRetryableError, PlaywrightCrawlingContext, Request, log, sleep, utils } from 'crawlee';
import { Page } from 'playwright';

import { LABELS } from './router.js';
import { validateInputCssSelectors } from '../configuration.js';
import { OpenAIModelHandler } from '../models/openai.js';
import { getNumberOfTextTokens, htmlToMarkdown, maybeShortsTextByTokenLength, shrinkHtml } from '../processors.js';
import { CrawlerState } from '../types/crawler-state.js';
import { PAGE_FORMAT } from '../types/input.js';
import { CrawlRouteUserData, GptRequestUserData } from '../types/user-data.js';
import { ERROR_TYPE, doesUrlMatchGlobs } from '../utils.js';

/**
 * The main crawling route. Enqueues new URLs and processes the page by calling the GPT model.
 */
export const crawlRoute = async (context: PlaywrightCrawlingContext<CrawlRouteUserData>) => {
    const { request, page, enqueueLinks, closeCookieModals, crawler } = context;

    const kvStore = await KeyValueStore.open();

    const state = await crawler.useState<CrawlerState>();
    const { config } = state;
    const {
        dynamicContentWaitSecs,
        excludeUrlGlobs,
        includeUrlGlobs,
        instructions,
        linkSelector,
        maxCrawlingDepth,
        maxPagesPerCrawl,
        modelConfig,
        pageFormat,
        removeElementsCssSelector,
        removeLinkUrls,
        saveSnapshots,
        skipGptGlobs,
        targetSelector,
    } = config;

    const model = new OpenAIModelHandler(modelConfig);

    const { depth = 0 } = request.userData;
    const isFirstPage = state.pagesOpened === 0;
    // perform an explicit check (to see if this request has already dealt with counters)
    // by the request key, so as to avoid it succeeding in case of other requests inheriting userData with `...userData`
    if (request.userData.wasOpenedKey !== request.uniqueKey) {
        if (state.pagesOpened >= maxPagesPerCrawl) {
            // performing a check in the preNavigationHook is helpful to prevent extra requests,
            // but as the counters are incremented only later in a different async function,
            // a race condition may occur when multiple pages are opened at the same time;
            // performing a double check here, synchronously before dealing with counters just below,
            // will ensure that this race condition is avoided
            const err = new NonRetryableError('Skipping this page');
            err.name = ERROR_TYPE.LIMIT_ERROR;
            throw err;
        }
        // only increment this counter once for each page (via the check in the outer `if`);
        // also, do not increment in the preNavigationHook, because the page might somehow not exist and before successful
        // navigation should not be counted
        state.pagesOpened++;
        // this flag is used in the checks for reaching the limit - a page that was allowed to open will ignore
        // the `pagesOpened` counter, which will deal with possible retries
        request.userData.wasOpenedKey = request.uniqueKey;
    }
    const url = request.loadedUrl || request.url;

    if (isFirstPage) await validateInputCssSelectors(config, page);

    log.info(`Opening ${url}...`);

    await waitForDynamicContent(page, dynamicContentWaitSecs);
    await closeCookieModals();

    // Enqueue links
    // If maxCrawlingDepth is not set or 0 the depth is infinite.
    const isDepthLimitReached = !!maxCrawlingDepth && depth >= maxCrawlingDepth;
    if (linkSelector && includeUrlGlobs?.length && !isDepthLimitReached) {
        const { processedRequests } = await enqueueLinks({
            selector: linkSelector,
            globs: includeUrlGlobs,
            exclude: excludeUrlGlobs,
            userData: {
                depth: depth + 1,
            },
        });
        const enqueuedLinks = processedRequests.filter(({ wasAlreadyPresent }) => !wasAlreadyPresent);
        const alreadyPresentLinksCount = processedRequests.length - enqueuedLinks.length;
        log.info(`Page ${url} enqueued ${enqueuedLinks.length} new URLs.`, {
            foundLinksCount: enqueuedLinks.length,
            enqueuedLinksCount: enqueuedLinks.length,
            alreadyPresentLinksCount,
        });
    }

    const skipGptProcessing = skipGptGlobs && doesUrlMatchGlobs(url, skipGptGlobs);
    if (skipGptProcessing) {
        log.info(`Skipping page from GPT processing because it matched 'skipGptGlobs', crawling only.`, { url });
        return;
    }

    // A function to be evaluated by Playwright within the browser context.
    let originContentHtml;
    if (targetSelector) {
        try {
            originContentHtml = await page.$eval(targetSelector, (el) => el.innerHTML);
        } catch (err) {
            log.error(`Cannot find targetSelector ${targetSelector} on ${url}, skipping this page.`, { err });
            return;
        }
    } else {
        originContentHtml = await page.content();
    }

    const shrunkHtml = await shrinkHtml(originContentHtml, { removeLinkUrls, removeElementsCssSelector });
    const originPageContent = pageFormat === PAGE_FORMAT.MARKDOWN ? htmlToMarkdown(shrunkHtml) : shrunkHtml;

    const instructionTokenLength = getNumberOfTextTokens(instructions);

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
        log.info(`Processing page ${url} with truncated text using GPT instruction...`, {
            originContentLength: originPageContent.length,
            contentLength: pageContent.length,
            contentMaxTokens,
        });
        log.warning(`Content was truncated for ${url} to match GPT maxTokens limit.`, {
            url,
            maxTokensLimit: model.modelConfig.maxTokens,
        });
    } else {
        log.info(`Processing page ${url} with GPT instruction...`, { contentLength: pageContent.length });
    }
    const remainingTokens = getNumberOfTextTokens(pageContent) + instructionTokenLength;

    const userData = { ...request.userData, pageContent, remainingTokens, snapshotKey, pageUrl: url, sentContentKey };
    const gptRequest = new Request<GptRequestUserData>({
        userData,
        uniqueKey: snapshotKey,
        url: 'https://fakeUrl.com',
        skipNavigation: true,
        label: LABELS.GPT,
    });

    await crawler.addRequests([gptRequest], { forefront: true });
};

/**
 * Waits for dynamic content to load on the page.
 * - Waits for the given `timeoutS` to pass, but breaks early if the network is idle (loaded all resources).
 */
const waitForDynamicContent = async (page: Page, timeoutS: number) => {
    const networkIdlePromise = page.waitForLoadState('networkidle');
    const timeoutPromise = sleep(timeoutS * 1000);

    return Promise.race([networkIdlePromise, timeoutPromise]);
};
