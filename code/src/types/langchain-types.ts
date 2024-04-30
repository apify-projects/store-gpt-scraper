/**
 * Langchain doesn't have a proper error type, so we need to make our own.
 * - The error message attribute changes depending on the error type.
 */
export type LangchainError = {
    error?: { message: string };
    code?: string;
    message?: string;

    name: string;
    status: number;
};

/**
 * Langchain doesn't have a proper function generation type, so we need to make our own.
 */
export type FunctionArgumentsGenerations = { message?: Message }[][];
type Message = { lc_kwargs?: { additional_kwargs?: { function_call?: { arguments?: string } } } };
