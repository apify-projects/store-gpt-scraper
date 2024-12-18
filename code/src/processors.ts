import { load } from 'cheerio';
import { encode } from 'gpt-3-encoder';

import { htmlToMarkdownProcessor } from './markdown.js';

const JSON_REGEX = /\{(?:[^{}]|())*\}/;

/**
 * Shrinks HTML by removing css targeted elements and extra spaces
 */
export const shrinkHtml = async (
    html: string,
    options: { removeLinkUrls: boolean; removeElementsCssSelector?: string },
) => {
    const { removeElementsCssSelector, removeLinkUrls } = options;

    const $ = load(html);

    if (removeElementsCssSelector) {
        $(removeElementsCssSelector).map((_, el) => $(el).remove());
    }
    if (removeLinkUrls) {
        $('a').map((_, el) => $(el).removeAttr('href'));
    }

    const stripped = $.html();
    return stripped
        .replace(/\s{2,}/g, ' ') // remove extra spaces
        .replace(/>\s+</g, '><') // remove all spaces between tags
        .replace(/^<!DOCTYPE[^>]*>/i, ''); // remove doctype
};

/**
 * Converts HTML to markdown
 * @param html
 */
export const htmlToMarkdown = (html: string) => {
    return htmlToMarkdownProcessor.turndown(html);
};

const chunkText = (text: string, maxLength: number) => {
    const numChunks = Math.ceil(text.length / maxLength);
    const chunks = new Array(numChunks);

    for (let i = 0, o = 0; i < numChunks; ++i, o += maxLength) {
        chunks[i] = text.substr(o, maxLength);
    }

    return chunks;
};

export const maybeShortsTextByTokenLength = (text: string, maxTokenLength: number) => {
    // OpenAI: A helpful rule of thumb is that one token generally corresponds to ~4 characters of text for common English text.
    if (text.length <= maxTokenLength * 4 && getNumberOfTextTokens(text) <= maxTokenLength) {
        return text;
    }
    let shortText = '';
    let shortTextTokens = 0;
    for (const textPart of chunkText(text, 100)) {
        shortTextTokens += getNumberOfTextTokens(textPart);
        if (shortTextTokens <= maxTokenLength) {
            shortText += textPart;
        } else {
            break;
        }
    }
    return shortText;
};

export const tryToParseJsonFromString = (str: string) => {
    try {
        return JSON.parse(str);
    } catch (err) {
        // Let's try to match json in text
        const jsonMatch = str.match(JSON_REGEX);
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[1]);
            } catch (err2) {
                // Ignore
            }
        }
    }
    return null;
};

export const getNumberOfTextTokens = (text: string) => {
    const encodedText = encode(text);
    return encodedText.length;
};
