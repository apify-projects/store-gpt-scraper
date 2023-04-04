# GPT Scraper

GPT Scraper is a powerful tool that leverages OpenAI's API to modify text obtained from a scraper. You can use the scraper to extract content from a website and then pass that content to the OpenAI API to make the GPT magic happen.

## How much does it cost?

GPT Scraper costs $0.009 per processed page. This price also includes the cost of the OpenAI API.
A free Apify account gives you $5 free usage credit each month, so you can scrape up to 555 pages for free.

## Usage

To get started with GPT Scraper, you need to set up the pages you want to scrape using [**Start URLs**](#start-urls) and then set up instructions on how the GTP scraper should handle each page. For instance, a simple scraper to load the URL https://news.ycombinator.com/ and instruct GPT to extract information from it will look like this:

![img](https://apify-uploads-prod.s3.amazonaws.com/11dd5210-7a03-4fd1-b157-3709d3296cf8_example_input_2.png)

You can configure the scraper and GTP using Input configuration to set up a more complex workflow.

## Input Configuration

GPT Scraper accepts a number of configuration settings.
These can be entered either manually in the user interface in [Apify Console](https://console.apify.com)
or programmatically in a JSON object using the [Apify API](https://apify.com/docs/api/v2#/reference/actors/run-collection/run-actor).
For a complete list of input fields and their types, please see the outline of the Actor's [Input-schema](https://apify.com/apify/playwright-scraper/input-schema).

### Start URLs

The **Start URLs** (`startUrls`) field represent the initial list of URLs of pages that the scraper will visit. You can either enter these URLs manually or one by one.

The scraper supports adding new URLs to scrape on the fly, either using the **[Link selector](#link-selector)** and **[Glob Patterns](#glob-patterns)** options.

### Link selector

The **Link selector** (`linkSelector`) field contains a CSS selector that is used to find links to other web pages (items with `href` attributes, e.g. `<div class="my-class" href="...">`).

On every page that is loaded, the scraper looks for all links matching **Link selector**, and checks that the target URL matches one of the [**Glob Patterns**](#glob-patterns). If it is a match, it then adds the URL to the request queue so that it's loaded by the scraper later on.

If **Link selector** is empty, the page links are ignored, and the scraper only loads pages specified in **[Start URLs](#start-urls)**.

### Glob Patterns

The **Glob Patterns** (`globs`) field specifies which types of URLs found by **[Link selector](#link-selector)** should be added to the request queue.

A glob pattern is simply a string with wildcard characters.

For example, a glob pattern `http://www.example.com/pages/**/*` will match all the
following URLs:

-   `http://www.example.com/pages/deeper-level/page`
-   `http://www.example.com/pages/my-awesome-page`
-   `http://www.example.com/pages/something`

### Instructions and prompts for GPT

This option tells GPT how to handle page content, e.g. you can send these prompts.

- "Summarize this page into three sentences."
- "Find a sentence that contains 'Apify Proxy' and return them as a list."

You can also instruct OpenAI to answer with "skip this page" if you don't want to process all the scraped content, e.g.

- "Summarize this page into three sentences. If the page is about proxies, answer with 'skip this page'.".

### Max crawling depth

Specifies how many links away from `Start URLs` the scraper will descend.
This value is a safeguard against infinite crawling depths for misconfigured scrapers.

### Max pages per run

The maximum number of pages that the scraper will open. 0 means unlimited.

### Proxy configuration

The **Proxy configuration** (`proxyConfiguration`) option enables you to set proxies
the scraper will use that to prevent its detection by target websites.
You can use both [Apify Proxy](https://apify.com/proxy) and custom HTTP or SOCKS5 proxy servers.

## Limits

The GPT model itself has a limit on the amount of content it can handle (i.e. maximum token limit). The scraped content will be truncated when this limit is reached.

## Tips & tricks

Here are a few hidden features that you might find helpful.

### Skip pages from the output

You can skip pages from the output by asking GPT to answer with `skip this page`, for example:

- "Summarize this page into three sentences. If the page is about proxies, answer with 'skip this page'.".

### Structured data answer with JSON

You can instruct GPT to answer with JSON, and the scraper under the hood will parse this JSON and store it as a structured answer, for example:

- "Find all links on this page and return them as JSON. There will be one attribute, `links`, containing an array of URLs."

## Example usage

Here are some example use cases that you can use as a starting point for your own GTP scraping experiments.

### Summarize a page

**Start URL:**
- https://en.wikipedia.org/wiki/COVID-19_pandemic

**Instructions for GPT**:
```text
Summarize this page into three sentences.
```

**Results**:
```json
[
  {
    "url": "https://en.wikipedia.org/wiki/COVID-19_pandemic",
    "answer": "This page on Wikipedia provides comprehensive information on the COVID-19 pandemic, including its epidemiology, disease symptoms and prevention strategies. The page also covers the history of the pandemic, national responses, and other measures taken by organizations such as the WHO and UN. The information is organized through a series of subsections for easy navigation.",
    "jsonAnswer": null
  }
]
```

### Extract keywords from a blog post

**Start URL:**
- https://blog.apify.com/step-by-step-guide-to-scraping-amazon/

**Prompt for GPT**
```Extract keywords from this blog post.```

**Results**:
```json
[{
  "url": "https://blog.apify.com/step-by-step-guide-to-scraping-amazon/",
  "answer": "Keywords: Web Scraping, Tutorial, Apify, Updates, Automation, Data Extraction, Ecommerce, Amazon, Product Data, API, Title, URL, Descriptions, Features, Prices, Images, Seller, Stock Status, ASINs, Proxy, Scraping.",
}]
```

### Summarize reviews of movies, games, or products

**Start URL:**
- https://www.imdb.com/title/tt10366206/reviews

**Instructions for GPT**:
```text
Analyze all user reviews for this movie and summarize the consensus.
```

**Results**:
```json
[{
  "url": "https://www.imdb.com/title/tt10366206/reviews",
  "answer": "The consensus among user reviews for John Wick: Chapter 4 (2023) is that it delivers exceptional action scenes and lives up to the high standards set by the previous films in the franchise. Many users praised the creativity and variety of the fight scenes, and Donnie Yen's performance in particular. Some noted minor flaws, such as an anticlimactic ending and a subplot with a tracker that did not feel consequential. Overall, users highly recommended the film to fans of the series and action movies in general.",
}]
```

### Find contact details on a web page

**Start URL:**
- https://apify.com/contact

**Instructions for GPT**:
```text
Please find contact details on this page and return them as JSON.
There will be attributes, companyEmail, companyWeb, githubUrl, twitterUrl,
vatId, businessId and backAccountNumber.
```

**Results**:
```json
[
  {
    "url": "https://apify.com/contact",
    "answer": "{\n    \"companyEmail\": \"hello@apify.com\",\n    \"companyWeb\": \"https://apify.com\",\n    \"githubUrl\": \"https://github.com/apify\",\n    \"twitterUrl\": \"https://twitter.com/apify\",\n    \"vatId\": \"CZ04788290\",\n    \"businessId\": \"04788290\",\n    \"backAccountNumber\": \"CZ0355000000000027434378\"\n}",
    "jsonAnswer": {
      "companyEmail": "hello@apify.com",
      "companyWeb": "https://apify.com",
      "githubUrl": "https://github.com/apify",
      "twitterUrl": "https://twitter.com/apify",
      "vatId": "CZ04788290",
      "businessId": "04788290",
      "backAccountNumber": "CZ0355000000000027434378"
    }
  }
]
```

## Other suggested use cases

* Find typos and grammatical errors across your entire website
* Analyze competing content to find keywords or ideas
* Examine code examples in content to find errors or suggest improvements
