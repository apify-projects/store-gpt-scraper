import { GlobInput } from 'crawlee';
import { minimatch } from 'minimatch';

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
