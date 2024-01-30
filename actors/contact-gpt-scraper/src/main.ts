import { Actor, Dataset } from 'apify';
import { log, social } from 'crawlee';
import { EnrichedContext, createCrawler, defaultPerformPageCrawl, defaultProcessGptResponse, prepareContent } from '@packages/gpt-scraper-core';
import type { Input } from './input.js';
import { updateDeprecatedInput } from './input.js';

// Initialize the Apify SDK
await Actor.init();

const input = await Actor.getInput() as Input;

if (!input) await Actor.fail('INPUT cannot be empty!');

await updateDeprecatedInput(input);

const crawler = await createCrawler({
    ...input,
    useStructureOutput: true,
    removeElementsCssSelector: 'script, style, noscript, path, svg, xlink',
    model: 'gpt-4-turbo',
}, contactsRequestHandler);

// default request handler used by the crawler
async function contactsRequestHandler(context: EnrichedContext) {
    const crawlResult = await defaultPerformPageCrawl(context);
    if (!crawlResult) return;
    const { originPageContent } = crawlResult;
    const {
        pageContent,
        snapshotKey,
        sentContentKey,
    } = await prepareContent(context, {
        instructions: input.instructions,
        originPageContent,
    });
    const socialLinks = social.parseHandlesFromHtml(originPageContent);
    const instructions = `Consider the following content:
        `;
    const schema = {
        type: 'object',
        properties:
            Object.fromEntries(
                Object.entries(socialLinks).map(
                    ([key, values]) => values.map((value: string) => [value, ({
                        type: 'object',
                        properties: {
                            // for phone entries some additional questions are to be asked,
                            ...(
                                key.includes('phone') ? {
                                    // sometimes the parser has false positives e.g. by scraping numbers from links,
                                    // whereas they are not actual phone numbers
                                    actualPhoneLikelihood: {
                                        type: 'number',
                                        description: `The likelihood that the phone number is an actual phone rather than used as something else.`,
                                    },
                                    phoneReasoning: {
                                        type: 'string',
                                        description: 'What is you reasoning for choosing likelihood for the phone number being actual or not?',
                                    },
                                    countryCode: {
                                        type: 'string',
                                        description: 'The country code of the phone number. Leave empty if already included',
                                    },
                                } : {}
                            ),
                            owner: {
                                type: 'string',
                                description: 'The owner of the contact.',
                            },
                        },
                    })],
                    ),
                ).flat(),
            ),
    };
    const outputItem = await defaultProcessGptResponse(context, {
        instructions,
        pageContent: `${pageContent}\n
        Now, consider the contacts that were extracted from the page:
Contacts: ${Object.entries(socialLinks).map(([key, values]) => `${key}: ${values.join(', ')}`).join('\n')}
        For each of the contact, determine its owner and, if it stated to be a phone number, determine the likelihood that it is an actual phone number
            (1 - it is specifically and unambiguously mentioned to be a phone number on the page, 0 - obviosuly not a phone number, just looks like one)
        `,
        snapshotKey,
        schema,
        sentContentKey,
    });
    if (!outputItem) return;
    const linksOutput: Record<string, {
        value: string;
        owner: string;
    }[]> = Object.fromEntries(
        Object.keys(socialLinks)
            .map((key) => [
                key,
                // make an object of the same form as `socialLinks` but with empty arrays
                [],
            ]),
    );
    for (const [key, value] of Object.entries<any>(outputItem.jsonAnswer)) {
        const contactType = Object.keys(socialLinks).find((linkType) => (<any>socialLinks)[linkType].includes(key));
        if (!contactType) {
            log.warning(`Could not categorize the contact ${key} into any of the known types. Skipping it.`);
            continue;
        }
        if ('actualPhoneLikelihood' in value && value.actualPhoneLikelihood < 0.5) {
            continue;
        }
        linksOutput[contactType].push({
            value: key,
            owner: value.owner,
            ...(value.countryCode ? { countryCode: value.countryCode } : {}),
        });
    }
    await Dataset.pushData<typeof linksOutput>(linksOutput);
}

log.info('Configuration completed. Starting the crawl.');
await crawler.run();
log.info(`Crawler finished.`);

// Exit successfully
await Actor.exit();
