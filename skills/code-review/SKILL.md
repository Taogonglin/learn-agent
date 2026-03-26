---
name: code-review
description: Review code for quality, bugs, and best practices
tags: development, quality
triggers: code, review, refactor, fix
---

# Code Review Skill

## Purpose
Thoroughly review code changes for correctness, performance, and maintainability.

## Review Checklist

1. **Correctness**
   - Logic errors
   - Edge cases
   - Error handling
   - Race conditions

2. **Performance**
   - Algorithmic complexity
   - Unnecessary operations
   - Memory usage
   - I/O efficiency

3. **Maintainability**
   - Clear naming
   - Proper comments
   - Test coverage
   - Documentation

4. **Security**
   - Injection vulnerabilities
   - Unsafe operations
   - Data exposure
   - Authentication/authorization

## Process

1. Read the code carefully, line by line
2. Identify potential issues
3. Suggest concrete improvements
4. Provide severity rating (critical/warning/info)
5. Summarize findings

## Output Format

```
## Code Review Summary
- Files reviewed: {count}
- Issues found: {critical} critical, {warning} warnings, {info} info

## Critical Issues
1. [Severity] {File}:{Line} - {Description}
   Suggestion: {Fix}

## Warnings
1. [Severity] {File}:{Line} - {Description}
   Suggestion: {Fix}

## Info
...
```
