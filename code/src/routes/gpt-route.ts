import { Actor, Dataset } from 'apify';
import { KeyValueStore, PlaywrightCrawlingContext, log } from 'crawlee';

import { ERROR_OCCURRED_MESSAGE, NonRetryableOpenaiAPIError, OpenaiAPIErrorToExitActor } from '../errors.js';
import { OpenAIModelHandler } from '../models/openai.js';
import { CrawlerState } from '../types/crawler-state.js';
import { GptRequestUserData } from '../types/user-data.js';

export const gptRoute = async (context: PlaywrightCrawlingContext<GptRequestUserData>) => {
    const { request, crawler } = context;
    const { pageContent, remainingTokens, pageUrl, snapshotKey, sentContentKey } = request.userData;

    const kvStore = await KeyValueStore.open();

    const state = await crawler.useState<CrawlerState>();
    const { config, modelStats } = state;
    const { instructions, modelConfig, modelSettings, schema, schemaDescription } = config;

    const model = new OpenAIModelHandler(modelConfig);

    let answer = '';
    let jsonAnswer: null | object;

    log.info(`Calling GPT for page ${pageUrl}.`);

    try {
        const answerResult = await model.processInstructionsWithRetry({
            instructions,
            content: pageContent,
            schema,
            schemaDescription,
            modelSettings,
            remainingTokens,
            apifyClient: Actor.apifyClient,
        });
        answer = answerResult.answer;
        jsonAnswer = answerResult.jsonAnswer;
        model.updateApiCallUsage(answerResult.usage, modelStats);
    } catch (error) {
        if (error instanceof OpenaiAPIErrorToExitActor) {
            throw await Actor.fail(error.message);
        }
        if (error instanceof NonRetryableOpenaiAPIError) {
            await Actor.setStatusMessage(ERROR_OCCURRED_MESSAGE, { level: 'WARNING' });
            return log.warning(error.message, { url: pageUrl });
        }
        throw error;
    }

    const SKIP_PAGE_KEYWORDS = [
        'skip this page',
        'skip this url',
        'skip the page',
        'skip the url',
        'skip url',
        'skip page',
    ];

    const answerLowerCase = answer?.toLocaleLowerCase() || '';
    if (SKIP_PAGE_KEYWORDS.includes(answerLowerCase)) {
        log.info(`Skipping page ${pageUrl} from output, the key word "skip this page" was found in answer.`, {
            answer,
        });
        return;
    }

    log.info(`Page ${pageUrl} processed.`, modelStats);

    // Store the results
    await Dataset.pushData({
        url: pageUrl,
        answer,
        jsonAnswer,
        htmlSnapshotUrl: snapshotKey
            ? `https://api.apify.com/v2/key-value-stores/${kvStore.id}/records/${snapshotKey}.html`
            : undefined,
        screenshotUrl: snapshotKey
            ? `https://api.apify.com/v2/key-value-stores/${kvStore.id}/records/${snapshotKey}.jpg`
            : undefined,
        sentContentUrl: sentContentKey
            ? `https://api.apify.com/v2/key-value-stores/${kvStore.id}/records/${sentContentKey}`
            : undefined,
        '#debug': {
            modelName: model.modelConfig.modelName,
            modelStats,
        },
    });
};
