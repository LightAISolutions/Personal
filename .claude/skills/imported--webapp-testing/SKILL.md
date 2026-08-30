---
name: webapp-testing
description: Toolkit for testing local and deployed web applications using Playwright. Supports verifying frontend functionality, debugging UI behavior, capturing browser screenshots, and viewing browser logs. Use when the user wants to test pages, verify visual appearance, check interactivity, or debug UI issues.
user-invocable: true
disable-model-invocation: false
allowed-tools: Read, Bash, Write, Edit
---

# Web Application Testing

*Imported from [anthropics/skills](https://github.com/anthropics/skills) — Anthropic's official skills repository.*

Test web applications by writing native Python Playwright scripts.

## Decision Tree: Choosing Your Approach

```
User task → Is it static HTML?
    ├─ Yes → Read HTML file directly to identify selectors
    │         ├─ Success → Write Playwright script using selectors
    │         └─ Fails/Incomplete → Treat as dynamic (below)
    │
    └─ No (dynamic webapp) → Is the server already running?
        ├─ No → Start a local server first, then proceed
        │
        └─ Yes → Reconnaissance-then-action:
            1. Navigate and wait for networkidle
            2. Take screenshot or inspect DOM
            3. Identify selectors from rendered state
            4. Execute actions with discovered selectors
```

## Testing GitHub Pages (This Repo)

For this repo, pages are deployed at `https://lightaisolutions.github.io/lightaisolutions/`. To test:

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('https://lightaisolutions.github.io/lightaisolutions/')
    page.wait_for_load_state('networkidle')

    # Verify the version indicator pill appears
    version_pill = page.locator('[id*="version"]')

    # Take a screenshot for visual verification
    page.screenshot(path='/tmp/page-test.png', full_page=True)

    browser.close()
```

## Reconnaissance-Then-Action Pattern

1. **Inspect rendered DOM**:
   ```python
   page.screenshot(path='/tmp/inspect.png', full_page=True)
   content = page.content()
   page.locator('button').all()
   ```

2. **Identify selectors** from inspection results

3. **Execute actions** using discovered selectors

## Common Pitfall

- **Don't** inspect the DOM before waiting for `networkidle` on dynamic apps
- **Do** wait for `page.wait_for_load_state('networkidle')` before inspection

## Best Practices

- Use `sync_playwright()` for synchronous scripts
- Always close the browser when done
- Use descriptive selectors: `text=`, `role=`, CSS selectors, or IDs
- Add appropriate waits: `page.wait_for_selector()` or `page.wait_for_timeout()`
- Install Playwright if needed: `pip install playwright && python -m playwright install chromium`

Developed by: LightAISolutions
