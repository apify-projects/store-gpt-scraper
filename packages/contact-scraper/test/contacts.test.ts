import { getModelByName, getNumberOfTextTokens, htmlToMarkdown, maybeShortsTextByTokenLength, shrinkHtml } from '@packages/gpt-scraper-core';
import { Browser, Page, chromium } from 'playwright';
import { beforeAll, expect, test } from 'vitest';
import { Actor, log } from 'apify';
import { INTRO_PROMPT, JSON_SCHEMA } from '../src/index.js';

let page: Page;
let browser: Browser;
let model: NonNullable<ReturnType<typeof getModelByName>>;

beforeAll(async () => {
    browser = await chromium.launch();
    page = await browser.newPage();
    model = getModelByName('gpt-4-turbo')!;
});

const extractPageContent = async (url: string) => {
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    const originContentHtml = await page.content();
    const shrunkHtml = await shrinkHtml(originContentHtml, page, 'script, style, noscript, path, svg, xlink');
    const originPageContent = htmlToMarkdown(shrunkHtml);

    const instructionTokenLength = getNumberOfTextTokens(INTRO_PROMPT);

    const contentMaxTokens = model.modelConfig.maxTokens * 0.9 - instructionTokenLength; // 10% buffer for answer
    const pageContent = maybeShortsTextByTokenLength(originPageContent, contentMaxTokens);
    return pageContent;
};

const testURLInclusion = (keyName: keyof typeof JSON_SCHEMA['properties'], urls: string[], jsonAnswer: any) => {
    expect(
        jsonAnswer[keyName]?.map((item: any) => {
            return {
                ...item,
                // avoid testing whitespaces, in particular with phone numbers
                url: item.url?.replace(/\s/g, ''),
            };
        }),
    ).toEqual(expect.arrayContaining(
        urls.map(
            (url) => expect.objectContaining(
                {
                    url: expect.stringContaining(
                        url.replace(/\s/g, ''),
                    ),
                },
            ),
        ),
    ));
};

type DetailsSpec = {
    [key in keyof typeof JSON_SCHEMA['properties']]?: string[];
}

const testWholeWebsiteDetails = (jsonAnswer: any, expectedWebsiteDetails: DetailsSpec) => {
    for (const [key, urls] of Object.entries(expectedWebsiteDetails)) {
        testURLInclusion(key as keyof typeof JSON_SCHEMA['properties'], urls as string[], jsonAnswer);
    }
};

const testWebsite = async (url: string, spec: DetailsSpec) => {
    const pageContent = await extractPageContent(url);
    log.info(`Extracted page content ${url}`);
    const answerResult = await model.processInstructionsWithRetry({
        instructions: INTRO_PROMPT,
        content: pageContent,
        modelSettings: {
            openAIApiKey: process.env.OPENAI_API_KEY!,
        },
        schema: JSON_SCHEMA,
        apifyClient: Actor.apifyClient,
    });
    const { jsonAnswer } = answerResult;
    expect(jsonAnswer).not.toBeNull();
    testWholeWebsiteDetails(jsonAnswer, spec);
};

test('Scrapes contacts from https://unbounce.com/contact-us/', async () => testWebsite('https://unbounce.com/contact-us/', {
    linkedin: ['https://linkedin.com/company/unbounce'],
    twitter: ['https://twitter.com/unbounce'],
    instagram: ['https://instagram.com/unbounce'],
    youtube: ['https://www.youtube.com/user/UnbounceVideos'],
    phones: ['1 604 484 1354', '49 800 505 2740', '61 1800 861 218', '44 808 178 0202', '1 888 515 9161'],
}), 100000);

test('Scrapes contacts from https://brandaffair.ro/contact', async () => testWebsite('https://brandaffair.ro/contact', {
    linkedin: ['https://www.linkedin.com/company/brandaffair-advertising/'],
    instagram: ['https://www.instagram.com/brandaffair_agency/'],
    phones: ['40724343949'],
    emails: ['contact@brandaffair.ro'],
}), 100000);

test('Scrapes contacts from https://www.ldaottawa.com/our-team-contact-info/', async () => testWebsite('https://www.ldaottawa.com/our-team-contact-info/', {
    twitter: ['https://twitter.com/ldaottawa'],
    facebook: ['https://www.facebook.com/ldaottawa'],
    emails: ['programs@ldaottawa.com', 'execdirector@ldaottawa.com'],
}), 100000);

test('Scrapes contacts from https://www.aucklandcouncil.govt.nz/report-problem/Pages/our-contact-details.aspx', async () => testWebsite('https://www.aucklandcouncil.govt.nz/report-problem/Pages/our-contact-details.aspx', {
    linkedin: ['https://www.linkedin.com/company/auckland-council'],
    twitter: ['https://twitter.com/aklcouncil'],
    instagram: ['https://www.instagram.com/aklcouncil'],
    youtube: ['https://www.youtube.com/user/AklCouncil'],
    phones: ['09 301 0101'],
}), 100000);

test('Scrapes contacts from https://www.justice.gov.za/master/contacts.htm', async () => testWebsite('https://www.justice.gov.za/master/contacts.htm', {
    phones: ['051 411 5500', '051 411 5511', '040 608 6600', '021 832 3000', '041 403 5100'],
    emails: ['EuDaniels@justice.gov.za', 'MasterThohoyandou@justice.gov.za', 'MasterCapeTown@justice.gov.za'],
}), 100000);
