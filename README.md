# GPT Scraper

This repository contains two actors.

- [Extended GPT Scraper](https://apify.com/apify/extended-gpt-scraper) - a more powerfull actor that scrapes a list of URLs and process content using OpenAI model.
- [GPT Scraper](https://apify.com/apify/gpt-scraper) - a simple actor that scrapes a list of URLs and sends them to GPT-3 for processing.

## Extended GPT Scraper

This actor is source code is under `/main-actor` directory.
It has all features and requires OpenAI API key on Input.

## GPT Scraper

This actor is source code is under `/pay-per-result-actor` directory.
It uses just subset of features and doesn't require OpenAI API key on Input.
It metamorphs into Extended GPT Scraper.
