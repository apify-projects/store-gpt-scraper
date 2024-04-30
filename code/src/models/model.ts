import { LLMChain } from 'langchain/chains';
import { PromptTemplate } from 'langchain/prompts';
import { LLMResult } from 'langchain/schema';
import { Runnable } from 'langchain/schema/runnable';
import { ModelConfig, ModelStats, ProcessInstructionsOptions, ProcessedInstructions, Usage } from '../types/model.js';

export abstract class GeneralModelHandler<ModelSettings extends object> {
    modelConfig: ModelConfig;

    constructor(modelConfig: ModelConfig) {
        this.modelConfig = modelConfig;
    }

    /**
     * Processes the instructions and returns the answer, jsonAnswer and usage.
     */
    abstract processInstructions(options: ProcessInstructionsOptions<ModelSettings>): Promise<ProcessedInstructions>;

    /**
     * Calls `processInstructions` and retries it if the API call fails.
     */
    abstract processInstructionsWithRetry(
        options: ProcessInstructionsOptions<ModelSettings>
    ): Promise<ProcessedInstructions>;

    /**
     * Updates the stats with the given usage.
     */
    public updateApiCallUsage(newUsage: Usage, modelStats: ModelStats) {
        const { usage } = modelStats;

        modelStats.apiCallsCount += 1;

        usage.promptTokens += newUsage.promptTokens;
        usage.completionTokens += newUsage.completionTokens;
        usage.totalTokens += newUsage.totalTokens;

        if (!this.modelConfig.cost) return;
        modelStats.usdUsage += this.modelConfig.cost.input * (newUsage.promptTokens / 1000);
        modelStats.usdUsage += this.modelConfig.cost.output * (newUsage.completionTokens / 1000);
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
}
