---
name: web-search
description: Search the web and extract relevant information
tags: research, search, data
triggers: search, find, lookup, research
---

# Web Search Skill

## Purpose
Search the web for information and extract relevant results.

## Process

1. **Query Formulation**
   - Refine search terms
   - Add relevant keywords
   - Consider time sensitivity

2. **Search Execution**
   - Query search engines
   - Retrieve top results
   - Filter by relevance

3. **Content Extraction**
   - Fetch page content
   - Extract key information
   - Remove boilerplate

4. **Synthesis**
   - Summarize findings
   - Cite sources
   - Highlight key points

## Tools Available

- `web_search`: Execute web search
- `fetch_url`: Fetch and parse URL content
- `extract_key_info`: Extract specific information

## Output Format

```markdown
## Search Results: {query}

### Summary
{brief summary of findings}

### Sources
1. [{title}]({url}) - {relevance summary}
2. ...

### Key Findings
- {finding 1}
- {finding 2}
- ...
```
