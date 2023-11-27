import { convert } from 'html-to-text';
import { htmlToMarkdownProcessor } from './markdown.js';
import { HTML_TAGS_TO_IGNORE } from './input.js';
import { getNumberOfTextTokens } from './openai.js';
import { Page } from 'playwright';

const JSON_REGEX = /\{(?:[^{}]|())*\}/;

/**
 * Converts HTML to text
 * @param html
 */
export const htmlToText = (html: string) => {
    const options: any = {
        wordwrap: false,
        selectors: HTML_TAGS_TO_IGNORE.map((tag) => ({ selector: tag, format: 'skip' })),
        // ignoreHref: true, // ignore href targets
    };
    const text = convert(html, options);
    return text
        .replace(/\n{2,}/g, '\n\n'); // remove extra new lines
};

/**
 * Shrinks HTML by removing script, style and no script tags and whitespaces
 * @param html
 */
export const shrinkHtml = async (html: string, page: Page) => {
    const stripped = await page.evaluate((unstripped) => {
        const doc = new DOMParser().parseFromString(unstripped, 'text/html');
        for (const tag of ['script', 'style', 'noscript', 'path', 'xlink']) {
            const elements = doc.querySelectorAll(tag);
            for (const element of elements) {
                element.remove();
            }
        }
        return doc.documentElement.outerHTML;
    }, html);
    return stripped.replace(/\s{2,}/g, ' ') // remove extra spaces
        .replace(/>\s+</g, '><'); // remove all spaces between tags
};

/**
 * Converts HTML to markdown
 * @param html
 */
export const htmlToMarkdown = (html: string) => {
    return htmlToMarkdownProcessor.turndown(html);
};

const chunkText = (text:string, maxLength: number) => {
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
