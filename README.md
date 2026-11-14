# dsh-free-search-mini

A small, keyless-first `free_search` tool for DeepSeek Harness. It does not use DSH's built-in `web_search` provider, so it does not depend on DeepSeek Search billing.

## Engines

In `auto` mode the tool tries:

1. **Firecrawl** — always tried first. With `firecrawlApiKey` set it uses that key; without one it tries Firecrawl's keyless tier. Keyless mode may reject proxy/VPN exit IPs; a free key (1,000 credits/month at the time of writing) avoids that.
2. **Tavily** — with `tavilyApiKey` set it uses that key; without one it tries Tavily's keyless tier (`x-tavily-access-mode: keyless`). Keyless has a daily quota and can be exhausted. Only `results[]` is used; Tavily's generated `answer` is ignored so every engine returns the same shape.
3. **Bing RSS** — no key, no registration.
4. **DuckDuckGo HTML** — no key, no registration; may rate-limit.
5. **Wikipedia** — no key; searches encyclopedia articles, not the general web. Chinese queries use `zh.wikipedia.org`, others use `en.wikipedia.org`.

Every engine is bounded by `timeoutMs`. A failed or empty engine falls through to the next one in `auto` mode. `firecrawl` and `tavily` also keep a fallback chain, so one bad key or an exhausted keyless quota cannot stop the whole tool; `bing`/`ddg`/`wiki` use only that engine.

## Configuration

| Field | Default | Meaning |
|---|---|---|
| `firecrawlApiKey` | empty | Optional Firecrawl key. Keep it in the plugin settings, not in shared files. |
| `firecrawlApiKeyEnv` | `FIRECRAWL_API_KEY` | Credential reference read through the harness credential center or the process environment when `firecrawlApiKey` is empty. |
| `tavilyApiKey` | empty | Optional Tavily key. |
| `tavilyApiKeyEnv` | `TAVILY_API_KEY` | Credential reference for the Tavily key. |
| `maxResults` | `10` | Default result cap (1–20). |
| `timeoutMs` | `12000` | Per-engine timeout in milliseconds. |

Keys are never hardcoded and are never echoed back to the browser. To set them, open **Plugins → Installed → dsh-free-search-mini**; the single configuration area has one **Firecrawl API key** field and one **Tavily API key** field, each with its own **Save** and **Clear key** actions. Alternatively set `FIRECRAWL_API_KEY` / `TAVILY_API_KEY` in the launch environment. To share the plugin, leave both key fields empty and let each user fill their own.

For local sharing, copy the package folder and run `pnpm install` in it (the only runtime dependency is `@deepseek-ai/schemastery`). For npm publishing, remove `"private": true` first.

## Usage

Ask the agent to search, for example:

> 用 free_search 搜一下 DeepSeek Harness 的最新消息

The tool accepts:

- `query` — required search text.
- `maxResults` — optional 1–20 cap.
- `source` — `auto` (default), `firecrawl`, `tavily`, `bing`, `ddg`, or `wiki`. `auto` uses the full Firecrawl → Tavily → Bing → DuckDuckGo → Wikipedia chain; `firecrawl` and `tavily` start at that engine and still fall back; `bing`/`ddg`/`wiki` use only that engine.

Search results are external, untrusted data. Use `web_fetch` to read a specific result URL.

## Limitations

- Bing RSS and DuckDuckGo HTML are public pages and can change or rate-limit.
- Wikipedia returns encyclopedia articles, not general web pages.
- Firecrawl's keyless mode is IP-sensitive; use a free API key when the exit IP is a proxy/VPN.
- Tavily's keyless tier has a daily quota (observed 429 `daily_cap_reached`); when it runs out the tool falls back automatically. A free Tavily key raises the limit.
- Tavily's generated `answer` is not surfaced: only its `results[]` are returned.
- No JavaScript rendering, login handling, PDF extraction, or search-result caching in this version.
- No special DoH/proxy handling: under the author's tested FAKE-IP setup, plain `fetch` reached Bing, DuckDuckGo, and Wikipedia normally. If a future proxy setup blocks DNS or HTTPS, the tool reports the failing engine instead of silently hanging.

## Development

```sh
node --test
```

The parsers are dependency-free and covered by fixed RSS/HTML/JSON fixtures in `test/engines.test.js`.
