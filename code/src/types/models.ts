/**
 * Input settings for OpenAI models.
 */
export interface OpenAIModelSettings {
    // We explicitly delete api key env var so that we know it is passed through params
    openAIApiKey: string;
    temperature?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
}
