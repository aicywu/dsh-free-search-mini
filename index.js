/**
 * `dsh-free-search-mini` — a small, keyless-first `free_search` tool.
 *
 * Engine order: Firecrawl (only with a key) → Bing RSS → DuckDuckGo HTML →
 * Wikipedia. Each engine is bounded by `timeoutMs`, and `auto` falls back on
 * failure or an empty result. The tool never reads DSH's built-in `web_search`
 * provider, so it does not depend on DeepSeek Search billing.
 */

import z from '@deepseek-ai/schemastery'

import {
  formatSearchOutput,
  parseSearchArgs,
  runFallback,
} from './lib/engines.js'

export const name = 'free-search-mini'

/** The tool registry is the only service this plugin needs. */
export const inject = ['tools']

/** User-editable settings; secrets stay out of source code. */
export const Config = z.object({
  /** Optional Firecrawl API key. Empty falls back to the credential reference below. */
  firecrawlApiKey: z.string().role('secret').volatile(),
  /** Credential reference read through the harness credential center or process environment. */
  firecrawlApiKeyEnv: z.string().role('credential-ref').default('FIRECRAWL_API_KEY').volatile(),
  /** Default upper bound on returned sources. */
  maxResults: z.number().step(1).min(1).max(20).default(10).volatile(),
  /** Per-engine timeout in milliseconds. */
  timeoutMs: z.number().step(1).min(1000).max(60_000).default(12_000).volatile(),
})

function readSetting(config, field, fallback) {
  const value = config?.[field]
  if (value !== null && typeof value === 'object' && typeof value.get === 'function') {
    return value.get() ?? fallback
  }
  return value ?? fallback
}

/** Resolve the Firecrawl key from settings, the credential center, or the environment. */
async function resolveFirecrawlKey(ctx, config) {
  const literal = readSetting(config, 'firecrawlApiKey', '')
  if (typeof literal === 'string' && literal.trim().length > 0) return literal.trim()

  const ref = readSetting(config, 'firecrawlApiKeyEnv', 'FIRECRAWL_API_KEY')
  if (typeof ref === 'string' && ref.length > 0) {
    const credentials = ctx.get('credentials')
    if (credentials !== undefined) {
      try {
        const resolved = await credentials.resolve(ref)
        if (typeof resolved?.value === 'string' && resolved.value.length > 0) return resolved.value
      } catch {
        // Fall through to the process environment; a missing credential store is not a tool error.
      }
    }
    const ambient = process.env[ref]
    if (typeof ambient === 'string' && ambient.length > 0) return ambient
  }
  return ''
}

/** Register the model-facing `free_search` tool. */
export function apply(ctx, config) {
  const maxResults = () => {
    const value = Number(readSetting(config, 'maxResults', 10))
    return Number.isInteger(value) && value >= 1 && value <= 20 ? value : 10
  }
  const timeoutMs = () => {
    const value = Number(readSetting(config, 'timeoutMs', 12_000))
    return Number.isInteger(value) && value >= 1000 && value <= 60_000 ? value : 12_000
  }

  ctx.tools.register({
    name: 'free_search',
    description:
      'Search the web for free. Uses Firecrawl when a key is configured, then Bing RSS, DuckDuckGo HTML, and Wikipedia as fallbacks. Returns source titles, URLs, and snippets.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query.',
        },
        maxResults: {
          type: 'integer',
          minimum: 1,
          maximum: 20,
          description: 'Maximum number of results (1-20; defaults to the plugin setting, normally 10).',
        },
        source: {
          type: 'string',
          enum: ['auto', 'firecrawl', 'bing', 'ddg', 'wiki'],
          description: 'Engine to use. auto tries Firecrawl (only with a key), then Bing, DuckDuckGo, and Wikipedia.',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          engine: { type: 'string' },
          sources: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                title: { type: 'string' },
                url: { type: 'string' },
                snippet: { type: 'string' },
                publishedAt: { type: 'string' },
              },
              required: ['url'],
            },
          },
          truncated: { type: 'boolean' },
          errors: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                engine: { type: 'string' },
                message: { type: 'string' },
              },
              required: ['engine', 'message'],
            },
          },
        },
        required: ['engine', 'sources', 'truncated', 'errors'],
      },
      render: (_args, value) => [{ type: 'text', text: formatSearchOutput(value) }],
    },
    timeoutMs: Math.min(60_000, timeoutMs() * 4 + 5_000),
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const parsed = parseSearchArgs(args, maxResults())
      const firecrawlApiKey = await resolveFirecrawlKey(ctx, config)
      return await runFallback({
        ...parsed,
        firecrawlApiKey,
        signal: exec.signal,
        timeoutMs: timeoutMs(),
      })
    },
    presentCall: args => ({
      card: 'generic',
      title: `Search: ${args.query}`,
      kind: 'search',
      rawInput: args.query,
    }),
  })
}
