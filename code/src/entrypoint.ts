import { Actor, log } from 'apify';

import { getOpenAiApiKeyEnvOrFail } from './input.js';
import { main } from './main.js';
import { ACTORS } from './types/actors.js';
import { Input } from './types/input.js';

await Actor.main(async () => {
    const input = await Actor.getInput<Input>();
    if (!input) throw await Actor.fail('INVALID INPUT: No input provided');

    let arg = process.env.ACTOR_PATH_IN_DOCKER_CONTEXT;
    if (!arg) {
        if (Actor.isAtHome()) {
            throw await Actor.exit({
                exitCode: 100,
                statusMessage:
                    'This Actor was built incorrectly, no environment variable specifying which Actor to start. If you see this, contact the Actor developer.',
            });
        }
        log.warning(
            `No env var ACTOR_PATH_IN_DOCKER_CONTEXT, using default for local development: actors/${ACTORS.SOURCE}`,
        );
        arg = `actors/${ACTORS.SOURCE}`;
    }

    arg = arg.split('/').at(-1);
    log.debug(`Received start argument: ${arg}`);

    switch (arg) {
        case ACTORS.SOURCE:
            return main(input);
        case ACTORS.PPR_PRICING:
            return main(adjustPprScraperInput(input));
        case ACTORS.EXTENDED:
            return main(adjustExtendedScraperInput(input));
        default:
            throw await Actor.exit({
                exitCode: 10,
                statusMessage: `This Actor was built incorrectly, unknown Actor selected to start (${arg}). If you see this, contact the Actor developer.`,
            });
    }
});

function adjustPprScraperInput(input: Input) {
    return {
        ...input,
        skipGptGlobs: [],
        model: 'DEFAULT_PPR_SCRAPER',
        openaiApiKey: getOpenAiApiKeyEnvOrFail(),
        actorType: ACTORS.PPR_PRICING,
    };
}

function adjustExtendedScraperInput(input: Input) {
    return {
        ...input,
        actorType: ACTORS.EXTENDED,
    };
}
