import { Config } from './config.js';
import { ModelStats } from './model.js';

export interface CrawlerState {
    config: Config;
    pagesOpened: number;
    modelStats: ModelStats;
}
