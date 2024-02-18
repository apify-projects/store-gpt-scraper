import { Config } from './config';

export interface CrawlerState {
    pagesOpened: number;
    config: Config;
}
