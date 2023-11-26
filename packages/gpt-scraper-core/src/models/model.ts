import { LLMChain } from 'langchain/chains';
import { PromptTemplate } from 'langchain/prompts';
import { LLMResult } from 'langchain/schema';
import { Runnable } from 'langchain/schema/runnable';
import { ModelConfig, ModelStats, ProcessInstructionsOptions, ProcessedInstructions, Usage } from '../types/model.js';

export abstract class GeneralModelHandler {
    modelConfig: ModelConfig;
    stats: ModelStats;

    constructor(modelConfig: ModelConfig) {
        this.modelConfig = modelConfig;
        this.stats = this.initStats();
    }

    /**
     * Processes the instructions and returns the answer, jsonAnswer and usage.
     */
    abstract processInstructions(options: ProcessInstructionsOptions): Promise<ProcessedInstructions>;

    /**
     * Calls `processInstructions` and retries it if the API call fails.
     */
    abstract processInstructionsWithRetry(options: ProcessInstructionsOptions): Promise<ProcessedInstructions>;

    /**
     * Updates the stats with the given usage.
     */
    public updateApiCallUsage(newUsage: Usage) {
        this.stats.apiCallsCount += 1;
        Object.keys(this.stats.usage).forEach((key: string) => {
            // @ts-ignore
            this.stats.usage[key] += newUsage[key] || 0;
        });

        if (!this.modelConfig.cost) return;
        this.stats.finalCostUSD += this.modelConfig.cost.input * (newUsage.promptTokens / 1000);
        this.stats.finalCostUSD += this.modelConfig.cost.output * (newUsage.completionTokens / 1000);
    }

    /**
     * Langchain returns some data in a callback instead of returning it directly.
     * This function allows saving and retrieving the data from the callback.
     */
    protected handleLLMEndCallbackHandler = () => {
        let output: LLMResult | null = null;

        const handleLLMEnd = async (callbackOutput: LLMResult) => {
            output = callbackOutput;
        };
        const getOutput = (): LLMResult => {
            if (!output) throw new Error('LLM callback did not return any output');

            return output;
        };

        return { handleLLMEnd, getOutput };
    };

    /**
     * Builds the LLMChain for the given model with our template.
     */
    protected buildLLMChain = (model: Runnable) => {
        const template = `{instructions}\`\`\`{content}\`\`\``;
        const prompt = new PromptTemplate({ template, inputVariables: ['instructions', 'content'] });

        return new LLMChain({ prompt, llm: model });
    };

    /**
     * Builds and returns an empty model stats object. Used in constructor.
     */
    private initStats(): ModelStats {
        return {
            apiCallsCount: 0,
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            finalCostUSD: 0,
        };
    }
}
