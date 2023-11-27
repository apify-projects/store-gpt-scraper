import { Actor } from 'apify';
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
