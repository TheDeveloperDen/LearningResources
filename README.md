# LearningResources

Crowdsourced collation of resources for learning programming

## What this is

This repository contains a crowdsourced compendium of curated resources for learning
various programming topics. Anyone is free to contribute, or use this data at no cost (although credit is appreciated).

The data is all stored in the YAML format and validated with a JSON Schema.

The data can be accessed with a simple REST api providing file indexing and access,
at https://learningresources.developerden.org

## How to contribute

Simply make a PR and submit it!
The format should be quite obvious from the existing examples, but make sure to validate any changes under the
[JSON Schema](/resources/resource.schema.json). You can use a website like [this](https://www.jsonschemavalidator.net/) to do this in development, or some editors can do it automatically. GitHub should automatically check when you submit a PR. 

### Guidelines

- Keep the pros and cons section as objective as possible
- Prices should be in US Dollars (eg `19.99`). If the price is free, omit the price tag
- Keep the descriptions for topics concise but descriptive
- For more abstract concepts, try and keep them generic rather than for a specific language.
  For example, "Dependency Injection" rather than "Dependency Injection in Java". You can then include
  more specific resources under this topic.
- File names should be in `lower_snake_case`, eg `dependency_injection.yaml`
