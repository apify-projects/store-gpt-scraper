import { Actor } from 'apify';
import { INTRO_PROMPT, JSON_SCHEMA, MODEL_NAME, MODEL_SETTINGS } from '@packages/contact-scraper';

await Actor.init();

// Get input of your Actor.
const input = (await Actor.getInput()) as Record<string, any>;

// Create input for apify/web-scraper
const newInput = {
    ...input,
    instructions: INTRO_PROMPT,
    useStructureOutput: true,
    schema: JSON_SCHEMA,
    model: MODEL_NAME,
    ...MODEL_SETTINGS,
};

// Transform the Actor run to apify/web-scraper
// with the new input.
await Actor.metamorph('drobnikj/extended-gpt-scraper', newInput);

// The line here will never be reached, because the
// Actor run will be interrupted.
await Actor.exit();
