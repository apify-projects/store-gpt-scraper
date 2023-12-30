import { PlaywrightCrawlingContext, log } from 'crawlee';
import { BLOCKED_STATUS_CODES, ProxyWebsiteStats } from '../proxy-manager.js';
import { CrawlerState } from '../types/crawler-state.js';
import { ProxyType } from '../types/proxy.js';
import { ProxyUserData } from '../types/user-data.js';

/**
 * Assigns a proxy type to the request. If explicit proxy configuration is provided, it is used. Otherwise:
 * - For the first request, the proxy type is picked based on the previous proxy stats for the given domain.
 * - For second and subsequent requests, the proxy type is always residential.
 */
export const proxyManagerHook = async (context: PlaywrightCrawlingContext) => {
    const { retryCount, url } = context.request;

    const hasCustomProxySettings = await hasCustomProxyConfiguration(context);
    if (hasCustomProxySettings) return;

    const isFirstRequest = retryCount === 0;
    if (!isFirstRequest) {
        await assignProxyTypeToContext(context, ProxyType.RESIDENTIAL);
        return;
    }

    const domain = new URL(url).hostname;

    const proxyType = ProxyWebsiteStats.getProxyTypeToUseFromStats(domain);
    await assignProxyTypeToContext(context, proxyType);
};

/**
 * Logs the request's proxy type and success to the stats. Throws an error if the status code is blocked.
 */
export const proxyManagerPostHook = async (context: PlaywrightCrawlingContext) => {
    const { request, response } = context as PlaywrightCrawlingContext<ProxyUserData>; // Crawlee doesn't have userData for hooks
    const { url, userData } = request;

    const hasCustomProxySettings = await hasCustomProxyConfiguration(context);
    if (hasCustomProxySettings) return;

    if (!response) return log.error(`No response for ${url}!`);

    const domain = new URL(url).hostname;

    const isBlocked = BLOCKED_STATUS_CODES.includes(response.status());
    ProxyWebsiteStats.logRequest(domain, userData.proxyType, !isBlocked);

    if (isBlocked) throw new Error(`Blocked. Response status code: ${response.status()}`);
};

const assignProxyTypeToContext = async (context: PlaywrightCrawlingContext, proxyType: ProxyType) => {
    const { crawler, request } = context;
    const { userData } = request;

    const state = await crawler.useState<CrawlerState>();
    const { proxies } = state.config;

    userData.proxyType = proxyType;
    context.proxyInfo = await proxies[proxyType]?.newProxyInfo();
};

const hasCustomProxyConfiguration = async (context: PlaywrightCrawlingContext) => {
    const { crawler } = context;
    const state = await crawler.useState<CrawlerState>();
    const { proxyConfiguration } = state.config;

    return !!proxyConfiguration;
};
