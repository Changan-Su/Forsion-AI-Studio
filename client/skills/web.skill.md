---
id: web
name: Web Access
description: Search the web and fetch URLs
icon: Globe
isBuiltin: true
tools:
  - name: web_search
    description: Search the web for current information. Returns a summary of top results.
    executor: builtin
    parameters:
      type: object
      properties:
        query:
          type: string
          description: The search query
      required:
        - query
  - name: url_fetch
    description: Fetch and return the text content of a URL.
    executor: builtin
    parameters:
      type: object
      properties:
        url:
          type: string
          description: The URL to fetch
        format:
          type: string
          description: 'Output format. Use "markdown" to strip HTML tags.'
          enum:
            - text
            - markdown
      required:
        - url
---

# Web Access Skill

You have access to live web information via these tools.

## When to use `web_search`
- When the user asks about current events, recent news, or anything that may have changed after your training cutoff.
- When you need factual data you are not confident about.
- Prefer short, specific queries for best results.

## When to use `url_fetch`
- When the user shares a URL and wants you to read its content.
- When a search result URL looks relevant and you want to read the full page.
- Use `format: markdown` for HTML pages to get clean readable text.
- Output is capped at 8000 characters; summarize long pages for the user.

## General guidelines
- Always cite the source URL when presenting web search results.
- Do not fabricate URLs. If you are not sure of a URL, use `web_search` to find it first.
