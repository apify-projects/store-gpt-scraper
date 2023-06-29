import { Actor, log } from 'apify';
import { Input } from './input.js';

// We used just one model to simplify pricing, if user wants to use with he needs to use extended version of the actor.
const DEFAULT_PEY_PER_RESULT_OPENAI_MODEL = 'gpt-3.5-turbo';

// Initialize the Apify SDK
await Actor.init();

if (!process.env.OPENAI_API_KEY) {
    await Actor.fail('OPENAI_API_KEY is not set!');
}

const input = await Actor.getInput() as Input;

if (!input) throw new Error('INPUT cannot be empty!');

let maxPaidDatasetItems: number | undefined;
let maxRequestsPerCrawl: number | undefined = input.maxPagesPerCrawl;
if (process.env.ACTOR_MAX_PAID_DATASET_ITEMS) {
    try {
        maxPaidDatasetItems = parseInt(process.env.ACTOR_MAX_PAID_DATASET_ITEMS, 10);
        if (!maxRequestsPerCrawl || maxRequestsPerCrawl === 0 || maxPaidDatasetItems < maxRequestsPerCrawl) {
            maxRequestsPerCrawl = maxPaidDatasetItems;
            log.info(`Maximum charged results option set to ${maxPaidDatasetItems}, the scraper will stop after that.`);
        }
    } catch (e) {
        log.warning(`Failed to parse ACTOR_MAX_PAID_DATASET_ITEMS: ${process.env.ACTOR_MAX_PAID_DATASET_ITEMS}`);
    }
}

await Actor.metamorph('drobnikj/extended-gpt-scraper', {
    ...input,
    maxPagesPerCrawl: maxRequestsPerCrawl,
    model: DEFAULT_PEY_PER_RESULT_OPENAI_MODEL,
    openaiApiKey: process.env.OPENAI_API_KEY,
});
