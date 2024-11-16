import { createPlaywrightRouter } from 'crawlee';

import { crawlRoute } from './crawl-route.js';
import { gptRoute } from './gpt-route.js';

export const LABELS = {
    GPT: 'GPT',
    CRAWL: 'CRAWL',
} as const;

export const router = createPlaywrightRouter();

router.addDefaultHandler(crawlRoute);
router.addHandler(LABELS.CRAWL, crawlRoute);
router.addHandler(LABELS.GPT, gptRoute);
