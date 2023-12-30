import { ProxyType } from './types/proxy.js';

type WebsiteRequestStats = {
    [key in ProxyType]: {
        total: number;
        successful: number;
    };
};

export const BLOCKED_STATUS_CODES = [401, 403, 429, 503];

export class ProxyWebsiteStats {
    private static websiteRequestStats: { [domain: string]: WebsiteRequestStats } = {};

    /**
     * Gets the proxy type to use for the given domain. The proxy type is picked to bring the total requests ratio closer
     * to the success rate ratio.
     * - e.g.: Success rate ratio is `0.1 (data center) : 0.9 (residential) = 0.11` and the total requests ratio is
     * `0.5 : 0.5 = 1`. Residential proxy type is picked because `0.11 < 1`. This will bring the total ratio closer to
     * success ratio (e.g. `0.45 : 0.55 = 0.81`).
     */
    public static getProxyTypeToUseFromStats(domain: string): ProxyType {
        if (!this.websiteRequestStats[domain]) {
            this.initializeDomain(domain);
            return ProxyType.DATA_CENTER;
        }

        const successRateRatio = this.getSuccessRateRatio(domain);
        const totalRequestsRatio = this.getTotalRequestsRatio(domain);

        const useDataCenter = successRateRatio > totalRequestsRatio;
        return useDataCenter ? ProxyType.DATA_CENTER : ProxyType.RESIDENTIAL;
    }

    /**
     * Logs the website request to the stats. The stats are later used to determine which proxy type to use.
     */
    public static logRequest(domain: string, proxyType: ProxyType, wasSuccess: boolean) {
        const stats = this.websiteRequestStats[domain][proxyType];

        stats.total++;
        if (wasSuccess) stats.successful++;
    }

    /**
     * Calculates the ratio success rate ratio between data center and residential proxies.
     * - adds `1` to data center successful to avoid the ratio being `0`, since we would then always pick residential
     */
    private static getSuccessRateRatio(domain: string): number {
        const dataCenter = this.websiteRequestStats[domain][ProxyType.DATA_CENTER];
        const residential = this.websiteRequestStats[domain][ProxyType.RESIDENTIAL];

        const dataCenterSuccessRate = (dataCenter.successful + 1) / dataCenter.total;
        const residentialSuccessRate = residential.successful / residential.total;

        return dataCenterSuccessRate / residentialSuccessRate;
    }

    private static getTotalRequestsRatio(domain: string): number {
        const dataCenter = this.websiteRequestStats[domain][ProxyType.DATA_CENTER];
        const residential = this.websiteRequestStats[domain][ProxyType.RESIDENTIAL];

        return dataCenter.total / residential.total;
    }

    private static initializeDomain(domain: string) {
        this.websiteRequestStats[domain] = {
            [ProxyType.DATA_CENTER]: { total: 0, successful: 0 },
            [ProxyType.RESIDENTIAL]: { total: 0, successful: 0 },
        };
    }
}
