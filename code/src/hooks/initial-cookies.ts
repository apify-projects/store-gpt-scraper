import { Actor } from 'apify';
import { PlaywrightCrawlingContext } from 'crawlee';

import { LABELS } from '../routes/router.js';
import { CrawlerState } from '../types/crawler-state.js';

/**
 * Adds the initial cookies to the session cookies, if they are not already present.
 * - We also check if the input cookies are valid and throw an error if they are not (we can't fully validate them on input)
 */
export const initialCookiesHook = async (context: PlaywrightCrawlingContext) => {
    const { page, crawler, request, session } = context;
    const { label } = request.userData;

    const isCrawlRoute = label === LABELS.CRAWL;
    if (!isCrawlRoute) return;

    const state = await crawler.useState<CrawlerState>();
    const { initialCookies } = state.config;

    if (!initialCookies) return;

    const sessionCookieNames = session?.getCookies(request.url)?.map((cookie) => cookie.name) || [];
    const newCookiesToAdd = initialCookies.filter((cookie) => !sessionCookieNames.includes(cookie.name));

    try {
        session?.setCookies(newCookiesToAdd, request.url);
        await page.context().addCookies(newCookiesToAdd);
    } catch (e) {
        await Actor.fail(`INVALID INPUT: invalid cookie(s) in 'initialCookies'! \n\t${e}`);
    }
};
