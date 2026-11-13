# dsh-free-search-mini

A small, keyless-first `free_search` tool for DeepSeek Harness. It does not use DSH's built-in `web_search` provider, so it does not depend on DeepSeek Search billing.

## Engines

In `auto` mode the tool tries:

1. **Firecrawl** — always tried first. With `firecrawlApiKey` set it uses that key; without one it tries Firecrawl's keyless tier. Keyless mode may reject proxy/VPN exit IPs; a free key (1,000 credits/month at the time of writing) avoids that.
2. **Bing RSS** — no key, no registration.
3. **DuckDuckGo HTML** — no key, no registration; may rate-limit.
4. **Wikipedia** — no key; searches encyclopedia articles, not the general web. Chinese queries use `zh.wikipedia.org`, others use `en.wikipedia.org`.

Every engine is bounded by `timeoutMs`. A failed or empty engine falls through to the next one in `auto` mode; an explicitly requested `source` reports its own failure instead.

## Configuration

| Field | Default | Meaning |
|---|---|---|
| `firecrawlApiKey` | empty | Optional Firecrawl key. Keep it in the plugin settings, not in shared files. |
| `firecrawlApiKeyEnv` | `FIRECRAWL_API_KEY` | Credential reference read through the harness credential center or the process environment when `firecrawlApiKey` is empty. |
| `maxResults` | `10` | Default result cap (1–20). |
| `timeoutMs` | `12000` | Per-engine timeout in milliseconds. |

The Firecrawl key is never hardcoded. To set it, open **Plugins → Installed → dsh-free-search-mini** and use the **Firecrawl API key** form on the bundle page. Alternatively set `FIRECRAWL_API_KEY` in the launch environment. To share the plugin, leave `firecrawlApiKey` empty and let each user fill their own key.

For local sharing, copy the package folder and run `pnpm install` in it (the only runtime dependency is `@deepseek-ai/schemastery`). For npm publishing, remove `"private": true` first.

## Usage

Ask the agent to search, for example:

> 用 free_search 搜一下 DeepSeek Harness 的最新消息

The tool accepts:

- `query` — required search text.
- `maxResults` — optional 1–20 cap.
- `source` — `auto` (default), `firecrawl`, `bing`, `ddg`, or `wiki`.

Search results are external, untrusted data. Use `web_fetch` to read a specific result URL.

## Limitations

- Bing RSS and DuckDuckGo HTML are public pages and can change or rate-limit.
- Wikipedia returns encyclopedia articles, not general web pages.
- Firecrawl's keyless mode is IP-sensitive; use a free API key when the exit IP is a proxy/VPN.
- No JavaScript rendering, login handling, PDF extraction, or search-result caching in this version.
- No special DoH/proxy handling: under the author's tested FAKE-IP setup, plain `fetch` reached Bing, DuckDuckGo, and Wikipedia normally. If a future proxy setup blocks DNS or HTTPS, the tool reports the failing engine instead of silently hanging.

## Development

```sh
node --test
```

The parsers are dependency-free and covered by fixed RSS/HTML/JSON fixtures in `test/engines.test.js`.
