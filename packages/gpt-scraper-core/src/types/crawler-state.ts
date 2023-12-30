import { ProxyConfiguration } from 'crawlee';
import { Input } from './input.js';
import { ProxyType } from './proxy.js';

export interface CrawlerState {
    pageOutputted: number;
    config: { proxies: Proxies } & Input;
}

export type Proxies = {
    [key in ProxyType]: ProxyConfiguration | undefined;
};
