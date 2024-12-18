# Extended GPT Scraper

Extended GPT Scraper is a powerful tool that leverages OpenAI's API to modify text obtained from a scraper.
You can use the scraper to extract content from a website and then pass that content to the OpenAI API to make the GPT magic happen.

## How does Extended GPT Scraper work?

The scraper first loads the page using [Playwright](https://playwright.dev/), then
it converts the content into markdown format and asks for GPT instructions about markdown content.

If the content doesn't fit into the GPT limit, the scraper will truncate the content. You can find the message about truncated content in the log.

## How much does it cost?

There are two costs associated with using GPT Scraper.

### Cost of the OpenAI API

You can find the cost of the OpenAI API on the [OpenAI pricing page](https://openai.com/pricing/).
The cost depends on the model you are using and the length of the content you are sending to the API for scraping.

### Cost of the scraping itself

The cost of the scraper is the same as the cost of [Web Scraper](https://apify.com/apify/web-scraper), because it uses the same browser under the hood.
You can find information about the cost on [the pricing page](https://apify.com/pricing) under the Detailed Pricing breakdown section.
The cost estimates are based on averages and may vary depending on the complexity of the pages you scrape.

> If you are looking for a basic and more predictable GPT Scraper that includes OpenAI API's cost, check out the [GPT Scraper](https://apify.com/drobnikj/gpt-scraper). It is also able to extract content from a website and then pass that content to the OpenAI API.

## How to use Extended GPT Scraper

To get started with Extended GPT Scraper, you need to set up the pages you want to scrape using [**Start URLs**](#start-urls) and set up instructions for how the scraper should handle each page and the OpenAI API key.
NOTE: You can find the OpenAI API key in your [OpenAI dashboard](https://beta.openai.com/account/api-keys).

You can configure the scraper and GTP using Input configuration to set up a more complex workflow.

## Input configuration

Extended GPT Scraper accepts a number of configuration settings.
These can be entered either manually in the user interface in [Apify Console](https://console.apify.com)
or programmatically in a JSON object using the [Apify API](https://apify.com/docs/api/v2#/reference/actors/run-collection/run-actor).
For a complete list of input fields and their types, please see the outline of the Actor's [Input-schema](https://apify.com/apify/playwright-scraper/input-schema).

### Start URLs

The **Start URLs** (`startUrls`) field represents the initial list of page URLs that the scraper will visit. You can enter a group of URLs together using file upload or one by one.

The scraper supports adding new URLs to scrape on the fly, either using the **[Link selector](#link-selector)** or **[Glob patterns](#glob-patterns)** options.

### Link selector

The **Link selector** (`linkSelector`) field contains a CSS selector that is used to find links to other web pages (items with `href` attributes, e.g. `<div class="my-class" href="...">`).

On every page that is loaded, the scraper looks for all links matching **Link selector**, and checks that the target URL matches one of the [**Glob patterns**](#glob-patterns). If it is a match, it then adds the URL to the request queue so that it's loaded by the scraper later on.

If **Link selector** is empty, the page links are ignored, and the scraper only loads pages specified in **[Start URLs](#start-urls)**.

### Glob patterns

The **Glob patterns** (`globs`) field specifies which types of URLs found by **[Link selector](#link-selector)** should be added to the request queue.

A glob pattern is simply a string with wildcard characters.

For example, a glob pattern `http://www.example.com/pages/**/*` will match all the
following URLs:

-   `http://www.example.com/pages/deeper-level/page`
-   `http://www.example.com/pages/my-awesome-page`
-   `http://www.example.com/pages/something`

### OpenAI API key

The API key for accessing OpenAI. You can get it from <a href='https://platform.openai.com/account/api-keys' target='_blank' rel='noopener'>OpenAI platform</a>.

### Instructions and prompts for GPT

This option tells GPT how to handle page content. For example, you can send the following prompts.

- "Summarize this page in three sentences."
- "Find sentences that contain 'Apify Proxy' and return them as a list."

You can also instruct OpenAI to answer with "skip this page" if you don't want to process all the scraped content, e.g.

- "Summarize this page in three sentences. If the page is about proxies, answer with 'skip this page'.".

### GPT Model

The **GPT Model** (`model`) option specifies which GPT model to use.
You can find more information about the models on the [OpenAI API documentation](https://platform.openai.com/docs/models/overview).
Keep in mind that each model has different pricing and features.

### Max crawling depth

This specifies how many links away from `Start URLs` the scraper will descend.
This value is a safeguard against infinite crawling depths for misconfigured scrapers.

### Max pages per run

The maximum number of pages that the scraper will open. 0 means unlimited.

### Formatted output

If you want to get data in a structured format, you can define [JSON schema](https://json-schema.org/understanding-json-schema/) using the `Schema` input option and enable the **Use JSON schema to format answer** option.
This schema will be used to format data into a structured JSON object, which will be stored in the output in the jsonAnswer attribute.

### Proxy configuration

The **Proxy configuration** (`proxyConfiguration`) option enables you to set proxies.
The scraper will use them to prevent its detection by target websites.
You can use both [Apify Proxy](https://apify.com/proxy) and custom HTTP or SOCKS5 proxy servers.
