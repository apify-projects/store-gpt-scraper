import { Dictionary, GlobInput, PlaywrightCrawlingContext } from 'crawlee';
import { minimatch } from 'minimatch';

import { UserData } from './types/user-data.js';

export const doesUrlMatchGlobs = (url: string, globs: GlobInput[]): boolean => {
    return globs.some((glob) => doesUrlMatchGlob(url, glob));
};

const doesUrlMatchGlob = (url: string, glob: GlobInput): boolean => {
    const globString = typeof glob === 'string' ? glob : glob.glob;

    return minimatch(url, globString, { nocase: true });
};

export enum ERROR_TYPE {
    LIMIT_ERROR = 'LimitError',
}

export const saveErrorResult = async (
    context: PlaywrightCrawlingContext<UserData>,
    additionalData: { error: string; errorDescription: string; debugInfo: Dictionary },
) => {
    const { request, crawler } = context;
    const { startUrl } = request.userData;

    const errorItem = {
        url: request.loadedUrl || request.url,
        startUrl,
        ...additionalData,
    };

    await crawler.pushData(errorItem);
};
