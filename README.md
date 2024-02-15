# GPT Scraper 

This repository contains two Actors: GPT Scraper and Extended GPT Scraper and a shared packages for them.

- [Extended GPT Scraper](https://apify.com/apify/extended-gpt-scraper) is a more powerful Actor that scrapes a list of URLs and processes content using the OpenAI model.
- [GPT Scraper](https://apify.com/apify/gpt-scraper) is a simple Actor that scrapes a list of URLs and sends them to GPT-3 for processing.

## Scraper core

This is package contains the core functionality for both Actors.
The package's source code can be found under the `packages/gpt-scraper-core` directory.

## Extended GPT Scraper 

This Actor's source code can be found under the `actors/extended-gpt-scraper` directory.
It has all features and requires an OpenAI API key on Input.

## GPT Scraper

This Actor's source code can be found under the `actors/gpt-scraper` directory.
It uses just a subset of features and doesn't require an OpenAI API key on Input.
