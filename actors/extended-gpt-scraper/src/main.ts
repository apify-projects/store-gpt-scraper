import { Actor } from 'apify';
import { log } from 'crawlee';
import { Input } from './input.js';
import { createCrawler } from '@packages/gpt-scraper-core';

// Initialize the Apify SDK
await Actor.init();

const input = await Actor.getInput() as Input;

if (!input) await Actor.fail('INPUT cannot be empty!');

const crawler = await createCrawler({ input });

log.info('Configuration completed. Starting the crawl.');
await crawler.run();
log.info(`Crawler finished.`);

// Exit successfully
await Actor.exit();
