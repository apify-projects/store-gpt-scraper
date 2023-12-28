This changelog tracks updates to both GTP Scraper and Extended GPT Scraper actors.

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