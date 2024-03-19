import { Config } from './config.js';

export interface CrawlerState {
    pagesOpened: number;
    config: Config;
}
