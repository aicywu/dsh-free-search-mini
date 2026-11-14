import assert from 'node:assert/strict'
import test from 'node:test'

import { Config, apply } from '../index.js'

const TAVILY_JSON = {
  query: 'DeepSeek Harness',
  answer: null,
  results: [
    {
      title: 'What Is DeepSeek Harness?',
      url: 'https://www.datacamp.com/blog/what-is-deepseek-harness',
      content: 'DeepSeek Harness is an agent runtime where everything is a plugin.',
    },
  ],
}

function captureDefinition() {
  let definition
  const ctx = {
    tools: { register: (def) => { definition = def; return () => {} } },
    get: () => undefined,
  }
  apply(ctx, Config({}))
  return definition
}

test('Config exposes Tavily key fields with the expected defaults', () => {
  const config = Config({})
  assert.equal(config.firecrawlApiKeyEnv.get(), 'FIRECRAWL_API_KEY')
  assert.equal(config.tavilyApiKeyEnv.get(), 'TAVILY_API_KEY')
  assert.equal(config.tavilyApiKey.get(), undefined)
})

test('apply registers free_search with tavily in the source enum', () => {
  const definition = captureDefinition()
  assert.equal(definition.name, 'free_search')
  assert.ok(definition.parameters.properties.source.enum.includes('tavily'))
  assert.match(definition.description, /Tavily/)
})

test('execute reaches Tavily keyless when Firecrawl fails and no keys are set', async () => {
  const definition = captureDefinition()
  const originalFetch = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url) => {
    calls.push(String(url))
    if (String(url).includes('firecrawl.dev')) {
      return new Response(JSON.stringify({ success: false, error: 'no key' }), { status: 403 })
    }
    if (String(url).includes('tavily.com')) {
      return new Response(JSON.stringify(TAVILY_JSON), { status: 200 })
    }
    return new Response('no results', { status: 500 })
  }
  try {
    const result = await definition.execute(
      { query: 'DeepSeek Harness', source: 'auto' },
      { signal: new AbortController().signal },
    )
    assert.equal(result.engine, 'tavily')
    assert.equal(result.sources.length, 1)
    assert.equal(result.sources[0].url, 'https://www.datacamp.com/blog/what-is-deepseek-harness')
    assert.equal(calls[0].includes('firecrawl.dev'), true)
    assert.equal(calls[1].includes('tavily.com'), true)
  } finally {
    globalThis.fetch = originalFetch
  }
})
