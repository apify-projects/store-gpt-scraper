/**
 * Input settings for OpenAI models.
 */
export interface OpenAIModelSettings {
    temperature?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
}
