import { log } from 'crawlee';
import { parseConfiguration } from './configuration.js';
import { createCrawler } from './crawler.js';
import { adjustDeprecatedInput } from './input.js';
import { Input } from './types/input.js';

export const main = async (input: Input) => {
    const upToDateInput = await adjustDeprecatedInput(input);
    const config = await parseConfiguration(upToDateInput);

    const crawler = await createCrawler(config);

    log.info('Configuration completed. Starting the crawl.');
    await crawler.run();
    log.info(`Crawler finished.`);
};
