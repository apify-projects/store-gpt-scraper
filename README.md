# GPT Scraper

This repository contains two Actors: GPT Scraper and Extended GPT Scraper.

- [Extended GPT Scraper](https://apify.com/apify/extended-gpt-scraper) is a more powerful Actor that scrapes a list of URLs and processes content using the OpenAI model.
- [GPT Scraper](https://apify.com/apify/gpt-scraper) is a simple actor that scrapes a list of URLs and sends them to GPT-3 for processing.

## Extended GPT Scraper

This Actor's source code can be found under the `/main-actor` directory.
It has all features and requires an OpenAI API key on Input.

## GPT Scraper

This Actor's source code can be found under the `/pay-per-result-actor` directory.
It uses just a subset of features and doesn't require an OpenAI API key on Input.
It metamorphs into the Extended GPT Scraper.
