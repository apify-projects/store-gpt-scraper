This changelog tracks updates to both GTP Scraper and Extended GPT Scraper actors.

### 2023-12-21
*Features*
- Add GPT model settings `temperature`, `topP`, `frequencyPenalty` and `presencePenalty` to input
- Allow using HTML as prompt to models. Default is still converting HTML to markdown before sending it to models.
- Store HTML, screenshot and markdown (as it was sent to GPT) as links to the output. This is enabled by default but can be turned off.

*Fixes*
- Fail actor run if GPT doesn't accept formatted output schema. This because GPT doesn't fully accept JSON schema but the problem happens very rarely.

*Changes*
- Use LangChain to connect to GPT models. This means some error messages are different.