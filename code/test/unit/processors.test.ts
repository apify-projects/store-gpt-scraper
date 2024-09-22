import { describe, expect, test } from 'vitest';

import { shrinkHtml } from '../../src/processors';

describe('shrinkHtml', () => {
    test('should shrink additional spaces', async () => {
        const html = `<html>   <head>      <title>Title1     end</title> </head> <body> <p>text    1   </p> </body></html>`;
        const result = await shrinkHtml(html, { removeLinkUrls: false });

        expect(result).toBe(`<html><head><title>Title1 end</title></head><body><p>text 1 </p></body></html>`);
    });

    test('should ignore doctype', async () => {
        const html = `<!DOCTYPE html><html><head></head><body><p>Test</p></body></html>`;
        const result = await shrinkHtml(html, { removeLinkUrls: false });

        expect(result).toBe(`<html><head></head><body><p>Test</p></body></html>`);
    });

    test('should remove link urls', async () => {
        const html = `<html><a href="http://example.com">Link</a><p class="test">Test</p></html>`;
        const result = await shrinkHtml(html, { removeLinkUrls: true });

        expect(result).toBe(`<html><head></head><body><a>Link</a><p class="test">Test</p></body></html>`);
    });

    test('should remove elements by css selector', async () => {
        const html = `<html><a href="http://example.com">Link</a><p class="not-remove">Test1</p><p class="remove">Test2</p></html>`;
        const result = await shrinkHtml(html, { removeLinkUrls: false, removeElementsCssSelector: '.remove' });

        expect(result).toBe(
            `<html><head></head><body><a href="http://example.com">Link</a><p class="not-remove">Test1</p></body></html>`,
        );
    });
});
