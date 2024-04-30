import Ajv, { AnySchema } from 'ajv';
import { Actor } from 'apify';
import { Cookie, RequestList, log } from 'crawlee';
import { Page } from 'playwright';
import { getModelConfigByName } from './models/models.js';
import { Config } from './types/config.js';
import { Input, PAGE_FORMAT } from './types/input.js';
import { ModelConfig } from './types/model.js';
import { OpenAIModelSettings } from './types/models.js';

// eslint-disable-next-line new-cap
const ajv = new Ajv.default();

/**
 * Parses the Actor's input into a config object and validates it. Throws an Actor fail if the input is invalid.
 */
export const parseConfiguration = async (input: Input): Promise<Config> => {
    const {
        dynamicContentWaitSecs = 0,
        excludeUrlGlobs,
        includeUrlGlobs,
        initialCookies,
        instructions,
        linkSelector,
        pageFormatInRequest = PAGE_FORMAT.MARKDOWN,
        removeElementsCssSelector,
        removeLinkUrls = false,
        saveSnapshots = true,
        skipGptGlobs,
        startUrls,
        targetSelector,
    } = input;

    const modelConfig = getModelConfigByName(input.model);
    if (!modelConfig) throw await Actor.fail(`Model ${input.model} is not supported`);

    const { schema, schemaDescription } = await parseSchemaConfig(input, modelConfig);

    const modelSettings = await parseOpenaiModelSettings(input);

    if (initialCookies) await validateInitialCookies(initialCookies);

    const proxyConfiguration = await Actor.createProxyConfiguration(input.proxyConfiguration);

    const { requests } = await RequestList.open({ sources: startUrls });

    const totalMaxItems = Number(process.env.ACTOR_MAX_PAID_DATASET_ITEMS) || Number.POSITIVE_INFINITY;
    const maxPagesPerCrawl = Math.min(input.maxPagesPerCrawl || Number.POSITIVE_INFINITY, totalMaxItems);
    log.info(`Max pages per crawl: ${maxPagesPerCrawl}`);

    // make sure to change 0 (unlimited) to a very high number, because this is used in arithmetics and comparisons
    const maxCrawlingDepth = input.maxCrawlingDepth || Number.POSITIVE_INFINITY;

    return {
        dynamicContentWaitSecs,
        excludeUrlGlobs,
        includeUrlGlobs,
        initialCookies,
        instructions,
        requests,
        linkSelector,
        maxCrawlingDepth,
        maxPagesPerCrawl,
        modelConfig,
        modelSettings,
        pageFormat: pageFormatInRequest,
        proxyConfiguration,
        removeElementsCssSelector,
        removeLinkUrls,
        saveSnapshots,
        schema,
        schemaDescription,
        skipGptGlobs,
        targetSelector,
    };
};

/**
 * Css selectors need to be validated in the browser context. We do the validation on the first page.
 */
export const validateInputCssSelectors = async (config: Config, page: Page) => {
    const { linkSelector, targetSelector, removeElementsCssSelector } = config;

    await validateInputCssSelector(linkSelector, 'linkSelector', page);
    await validateInputCssSelector(targetSelector, 'targetSelector', page);
    await validateInputCssSelector(removeElementsCssSelector, 'removeElementsCssSelector', page);
};

const parseSchemaConfig = async (input: Input, model: ModelConfig) => {
    const modelSupportsSchema = model.interface === 'chat';
    const useSchema = input.useStructureOutput && input.schema && modelSupportsSchema;
    const schema = useSchema ? await validateSchemaOrFail(input.schema) : undefined;

    const isUnsupportedSchemaModel = input.useStructureOutput && input.schema && !modelSupportsSchema;
    if (isUnsupportedSchemaModel) {
        log.warning(`Schema is not supported for model ${model.modelName}! Ignoring schema.`);
    }

    const useInstructionsForSchemaDescription = useSchema && !input.schemaDescription && input.instructions;
    if (useInstructionsForSchemaDescription) {
        log.warning(`Schema description is not set, using instructions as schema description.`);
    }
    const schemaDescription = input.schemaDescription || input.instructions;

    return { schema, schemaDescription };
};

/**
 * Parse and validate JSON schema, if valid return it, otherwise failed actor.
 * @param schema
 */
const validateSchemaOrFail = async (schema: AnySchema | undefined): Promise<AnySchema | undefined> => {
    if (!schema) {
        await Actor.fail(
            'Schema is required when using "Use JSON schema to format answer" option. Provide the correct JSON schema or disable this option.',
        );
        return;
    }
    try {
        ajv.compile(schema);
        return schema;
    } catch (e: any) {
        log.error(`Schema is not valid: ${e.message}`, { error: e });
        await Actor.fail(
            'Schema is not valid. Go to Actor run log, '
            + 'where you can find error details or disable "Use JSON schema to format answer" option.',
        );
    }
    return undefined;
};

const parseOpenaiModelSettings = async (input: Input): Promise<OpenAIModelSettings> => {
    // OpenAI defaults to 1, but we want the crawlers to be deterministic
    const temperatureOptions = { default: 0, range: { min: 0, max: 2 } };
    const temperature = await parseNumberInRange(input.temperature, 'temperature', temperatureOptions);

    const topPOptions = { default: 1, range: { min: 0, max: 1 } };
    const topP = await parseNumberInRange(input.topP, 'topP', topPOptions);

    const frequencyOptions = { default: 0, range: { min: 0, max: 2 } };
    const frequencyPenalty = await parseNumberInRange(input.frequencyPenalty, 'frequencyPenalty', frequencyOptions);

    const presenceOptions = { default: 0, range: { min: 0, max: 2 } };
    const presencePenalty = await parseNumberInRange(input.presencePenalty, 'presencePenalty', presenceOptions);

    const modelSettings: OpenAIModelSettings = {
        openAIApiKey: input.openaiApiKey,
        temperature,
        topP,
        frequencyPenalty,
        presencePenalty,
    };

    return modelSettings;
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
