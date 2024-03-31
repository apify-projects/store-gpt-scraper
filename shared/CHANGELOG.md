This changelog tracks updates to both GTP Scraper and Extended GPT Scraper actors.

# 2024-03-05
*Features*
- Added option to wait for a specific time and let the page load before scraping, useful for dynamic pages. (`dynamicContentWaitSecs`)
- Added option to remove link URLs while keeping their displayed text. Helps to reduce the amount of content sent to GPT. (`removeLinkUrls`)

# 2024-03-05
*Features*
- Added separate schema description field (input `schemaDescription`). By default the value is taken from `instructions` input.
- Refactored and improved the Actor's input schema to be more user-friendly.

*Fixes*
- Properly handle OpenAI's schema description too long error.

# 2024-01-31
*Fixes*
- Eliminated the bug, when on some sites that contain erronous javascript the scraper would fail

### 2024-01-26
*Fixes*
- Fixed "max pages per run" not working correctly on specific websites.

### 2024-01-21
*Fixes*
- Fixed a bug where the Actor would fail on "repetitive patterns in prompt" error from OpenAI. The Actor will now gracefully skip GPT processing for the webpages that trigger the error.

### 2024-01-10
*Features*
- Added `excludeUrlGlobs` and renamed `globs` to `includeUrlGlobs`, the old `globs` input will still work the same.
- Added `initialCookies` to be able to extract data behind login.
- Added `removeElementsCssSelector` to enable custom HTML cleanup before sending to models.
- Added support for GPT-4 Turbo model. (Extended GPT Scraper only)
- Added `skipGptGlobs` to enable not using GPT on some pages that should only be used for finding further links. (Extended GPT Scraper only)

*Fixes*
- Always return `answer` in the output for consistency. It was previously sometimes missing if `jsonAnswer` was available.
- Improve error handling for errors coming from OpenAI. The actor will now fail if user doesn't have access to a model

### 2023-12-21
*Features*
- Add GPT model settings `temperature`, `topP`, `frequencyPenalty` and `presencePenalty` to input
- Allow using HTML as a prompt to models. By default, the actor still converts HTML to markdown before sending it to models.
- Store HTML, screenshot and content (as it was sent to GPT) as links to the output. This is enabled by default but can be turned off.

*Fixes*
- Fail an actor run if GPT doesn't accept formatted output schema defined by the user in input. This can happen because OpenAI doesn't fully follow JSON Schema specification but the problem happens very rarely.

*Changes*
- Use LangChain to connect to GPT models. This means some error messages are different.
- The default model `temperature` is now set to `0` instead of `1`. This should improve the reliability of scraping. While this is technically a breaking change, it should mostly behave as an improvement so we don't consider need to release a separate version.
