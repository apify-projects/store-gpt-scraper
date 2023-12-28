import { Actor } from 'apify';
import { Cookie } from 'crawlee';
import { Page } from 'playwright';
import { Input } from './types/input';

export const HTML_TAGS_TO_IGNORE = ['script', 'style', 'noscript'];

/**
 * Parses the Actor input. Throws an Actor fail if the input is invalid.
 */
export const parseInput = async (input: Input) => {
    // OpenAI defaults to 1, but we want the crawlers to be deterministic
    const temperatureOptions = { default: 0, range: { min: 0, max: 2 } };
    const temperature = await parseNumberInRange(input.temperature, 'temperature', temperatureOptions);

    const topPOptions = { default: 1, range: { min: 0, max: 1 } };
    const topP = await parseNumberInRange(input.topP, 'topP', topPOptions);

    const frequencyOptions = { default: 0, range: { min: 0, max: 2 } };
    const frequencyPenalty = await parseNumberInRange(input.frequencyPenalty, 'frequencyPenalty', frequencyOptions);

    const presenceOptions = { default: 0, range: { min: 0, max: 2 } };
    const presencePenalty = await parseNumberInRange(input.presencePenalty, 'presencePenalty', presenceOptions);

    return {
        ...input,
        temperature,
        topP,
        frequencyPenalty,
        presencePenalty,
    };
};

/**
 * Validates the Actor input. Throws an Actor fail if the input is invalid.
 */
export const validateInput = async (input: Input) => {
    const { initialCookies } = input;

    if (initialCookies) await validateInitialCookies(initialCookies);
};

/**
 * Css selectors need to be validated in the browser context. We do the validation on the first page.
 */
export const validateInputCssSelectors = async (input: Input, page: Page) => {
    const { linkSelector, targetSelector, removeElementsCssSelector } = input;

    await validateInputCssSelector(linkSelector, 'linkSelector', page);
    await validateInputCssSelector(targetSelector, 'targetSelector', page);
    await validateInputCssSelector(removeElementsCssSelector, 'removeElementsCssSelector', page);
};

const parseNumberInRange = async (
    property: unknown,
    propertyName: string,
    options: { default: number; range: { min: number; max: number } },
) => {
    const parsedNumber = (await parseStringyNumber(property, propertyName)) ?? options.default;
    await validateNumberInRange(parsedNumber, propertyName, options.range);

    return parsedNumber;
};

const parseStringyNumber = async (property: unknown, propertyName: string) => {
    if (property === undefined || property === null) return null;
    if (typeof property === 'string') {
        const parsedNumber = parseFloat(property);
        if (!Number.isNaN(parsedNumber)) return parsedNumber;
    }

    throw await Actor.fail(`INVALID INPUT: '${propertyName}' must be a stringy number! Got '${property}'`);
};

const validateNumberInRange = async (property: number, propertyName: string, range: { min: number; max: number }) => {
    if (property >= range.min && property <= range.max) return true;

    throw await Actor.fail(
        `INVALID INPUT: '${propertyName}' must be in range between ${range.min} and ${range.max}! Got '${property}'`,
    );
};

/**
 * Very basic validation of the initial cookies. We can't do a full cookie validation here.
 * - We do the full validation in `initialCookiesHook` with a browser from crawling context.
 */
const validateInitialCookies = async (cookies: unknown): Promise<Cookie[]> => {
    if (!Array.isArray(cookies)) throw await Actor.fail(`INVALID INPUT: 'initialCookies' must be an array!`);

    if (!cookies.every((cookie) => typeof cookie === 'object')) {
        throw await Actor.fail(`INVALID INPUT: 'initialCookies' must be an array of Cookie objects!`);
    }

    return cookies as Cookie[];
};

const validateInputCssSelector = async (selector: string | undefined | null, inputName: string, page: Page) => {
    if (selector === undefined || selector === null) return;

    try {
        await page.$(selector);
    } catch (e) {
        throw await Actor.fail(`INVALID INPUT: '${inputName}' is not a valid CSS selector! Got '${selector}'`);
    }
};
