import assert from 'node:assert/strict'
import test from 'node:test'

import {
  formatSearchOutput,
  parseBingRss,
  parseDdgHtml,
  parseFirecrawlJson,
  parseSearchArgs,
  parseTavilyJson,
  parseWikipediaJson,
  runFallback,
} from '../lib/engines.js'

const BING_RSS = `<?xml version="1.0" encoding="utf-8" ?>
<rss version="2.0"><channel><title>Bing: DeepSeek Harness</title>
<item>
  <title>DeepSeek Harness | Explore the limits of intelligence</title>
  <link>https://www.deepseek.com/en/harness/</link>
  <description>DeepSeek Harness is an agent framework.</description>
  <pubDate>Mon, 10 Nov 2026 00:00:00 GMT</pubDate>
</item>
<item>
  <title><![CDATA[GitHub - deepseek-ai/deepseek-harness]]></title>
  <link>https://github.com/deepseek-ai/deepseek-harness</link>
  <description><![CDATA[DeepSeek Harness: Everything is a plugin.]]></description>
</item>
</channel></rss>`

const DDG_HTML = `<html><body>
<div class="result results_links results_links_deep web-result">
  <h2 class="result__title">
    <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.deepseek.com%2Fen%2Fharness%2F&amp;rut=abc">DeepSeek Harness | Explore the limits of intelligence</a>
  </h2>
  <a class="result__snippet" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.deepseek.com%2Fen%2Fharness%2F">DeepSeek Harness is an agent framework.</a>
</div>
<div class="result results_links results_links_deep web-result">
  <h2 class="result__title">
    <a rel="nofollow" class="result__a" href="/l/?uddg=https%3A%2F%2Fgithub.com%2Fdeepseek-ai%2Fdeepseek-harness">GitHub - deepseek-ai/deepseek-harness</a>
  </h2>
  <a class="result__snippet">Everything is a plugin.</a>
</div>
</body></html>`

const WIKI_JSON = {
  batchcomplete: '',
  query: {
    search: [
      {
        title: 'DeepSeek Harness',
        snippet: '<span class="searchmatch">DeepSeek</span> <span class="searchmatch">Harness</span>是深度求索公司的 Agent 框架。',
        pageid: 1,
      },
    ],
  },
}

const FIRECRAWL_JSON = {
  success: true,
  data: {
    web: [
      {
        title: 'DeepSeek Harness',
        url: 'https://www.deepseek.com/en/harness/',
        description: 'DeepSeek Harness is an agent framework.',
      },
    ],
  },
}

const TAVILY_JSON = {
  query: 'DeepSeek Harness',
  answer: null,
  results: [
    {
      title: 'What Is DeepSeek Harness?',
      url: 'https://www.datacamp.com/blog/what-is-deepseek-harness',
      content: 'DeepSeek Harness is an agent runtime where everything is a plugin.',
      score: 0.91,
      published_date: 'Tue, 11 Nov 2026 17:00:00 GMT',
    },
    {
      title: 'DeepSeek Harness (dsh) 教程',
      url: 'https://deepseekdocs.com/',
      content: '安装与配置教程。',
      score: 0.88,
    },
  ],
}

test('parseTavilyJson maps Tavily results into normalized sources', () => {
  const sources = parseTavilyJson(TAVILY_JSON, 10)
  assert.equal(sources.length, 2)
  assert.deepEqual(sources[0], {
    title: 'What Is DeepSeek Harness?',
    url: 'https://www.datacamp.com/blog/what-is-deepseek-harness',
    snippet: 'DeepSeek Harness is an agent runtime where everything is a plugin.',
    publishedAt: 'Tue, 11 Nov 2026 17:00:00 GMT',
  })
  assert.deepEqual(sources[1], {
    title: 'DeepSeek Harness (dsh) 教程',
    url: 'https://deepseekdocs.com/',
    snippet: '安装与配置教程。',
  })
})

test('parseTavilyJson ignores the answer field and caps results', () => {
  const withAnswer = { ...TAVILY_JSON, answer: 'A synthesized answer that must not leak into sources.' }
  const sources = parseTavilyJson(withAnswer, 1)
  assert.equal(sources.length, 1)
  assert.equal(JSON.stringify(sources).includes('synthesized answer'), false)
})

test('parseBingRss returns normalized sources from an RSS feed', () => {
  const sources = parseBingRss(BING_RSS, 10)
  assert.equal(sources.length, 2)
  assert.deepEqual(sources[0], {
    title: 'DeepSeek Harness | Explore the limits of intelligence',
    url: 'https://www.deepseek.com/en/harness/',
    snippet: 'DeepSeek Harness is an agent framework.',
    publishedAt: 'Mon, 10 Nov 2026 00:00:00 GMT',
  })
  assert.equal(sources[1].title, 'GitHub - deepseek-ai/deepseek-harness')
})

test('parseDdgHtml decodes DuckDuckGo redirect links and snippets', () => {
  const sources = parseDdgHtml(DDG_HTML, 10)
  assert.equal(sources.length, 2)
  assert.equal(sources[0].url, 'https://www.deepseek.com/en/harness/')
  assert.equal(sources[0].title, 'DeepSeek Harness | Explore the limits of intelligence')
  assert.equal(sources[0].snippet, 'DeepSeek Harness is an agent framework.')
  assert.equal(sources[1].url, 'https://github.com/deepseek-ai/deepseek-harness')
})

test('parseWikipediaJson returns article links and strips snippet markup', () => {
  const sources = parseWikipediaJson(WIKI_JSON, 'zh', 10)
  assert.equal(sources.length, 1)
  assert.equal(sources[0].url, 'https://zh.wikipedia.org/wiki/DeepSeek_Harness')
  assert.equal(sources[0].title, 'DeepSeek Harness')
  assert.equal(sources[0].snippet, 'DeepSeek Harness是深度求索公司的 Agent 框架。')
})

test('parseFirecrawlJson accepts the v2 web result shape', () => {
  const sources = parseFirecrawlJson(FIRECRAWL_JSON, 10)
  assert.equal(sources.length, 1)
  assert.equal(sources[0].url, 'https://www.deepseek.com/en/harness/')
  assert.equal(sources[0].title, 'DeepSeek Harness')
})

test('runFallback tries Firecrawl keyless before Bing when no key is configured', async () => {
  const calls = []
  const result = await runFallback({
    query: 'DeepSeek Harness',
    maxResults: 10,
    source: 'auto',
    firecrawlApiKey: '',
    fetchImpl: async (url) => {
      calls.push(String(url))
      if (String(url).includes('firecrawl.dev')) {
        return new Response(JSON.stringify(FIRECRAWL_JSON), { status: 200 })
      }
      return new Response(BING_RSS, { status: 200 })
    },
  })
  assert.equal(result.engine, 'firecrawl')
  assert.equal(result.sources.length, 1)
  assert.equal(calls[0].includes('firecrawl.dev'), true)
  assert.deepEqual(result.errors, [])
})

test('runFallback tries Firecrawl without an Authorization header when no key is configured', async () => {
  let request
  await runFallback({
    query: 'DeepSeek Harness',
    maxResults: 10,
    source: 'firecrawl',
    firecrawlApiKey: '',
    fetchImpl: async (url, options) => {
      request = { url: String(url), options }
      return new Response(JSON.stringify(FIRECRAWL_JSON), { status: 200 })
    },
  })
  assert.equal(request.url.includes('firecrawl.dev'), true)
  assert.equal(request.options.headers.authorization, undefined)
})

test('runFallback falls back to Bing when an explicit firecrawl source has an invalid key', async () => {
  const calls = []
  const result = await runFallback({
    query: 'DeepSeek Harness',
    maxResults: 10,
    source: 'firecrawl',
    firecrawlApiKey: 'bad-key',
    fetchImpl: async (url) => {
      calls.push(String(url))
      if (String(url).includes('firecrawl.dev')) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized: Invalid token' }), { status: 401 })
      }
      return new Response(BING_RSS, { status: 200 })
    },
  })
  assert.equal(result.engine, 'bing')
  assert.equal(result.sources.length, 2)
  assert.equal(result.errors[0].engine, 'firecrawl')
  assert.match(result.errors[0].message, /401/)
  assert.equal(calls[0].includes('firecrawl.dev'), true)
})

test('runFallback falls back to Bing when keyless Firecrawl is refused', async () => {
  const calls = []
  const result = await runFallback({
    query: 'DeepSeek Harness',
    maxResults: 10,
    source: 'auto',
    firecrawlApiKey: '',
    fetchImpl: async (url) => {
      calls.push(String(url))
      if (String(url).includes('firecrawl.dev')) {
        return new Response(JSON.stringify({ success: false, error: 'IP looks like a VPN or proxy' }), { status: 403 })
      }
      return new Response(BING_RSS, { status: 200 })
    },
  })
  assert.equal(result.engine, 'bing')
  assert.equal(result.sources.length, 2)
  assert.equal(result.errors[0].engine, 'firecrawl')
  assert.match(result.errors[0].message, /403/)
  assert.equal(calls[0].includes('firecrawl.dev'), true)
})

test('runFallback falls back to DuckDuckGo when Bing fails', async () => {
  const result = await runFallback({
    query: 'DeepSeek Harness',
    maxResults: 10,
    source: 'auto',
    firecrawlApiKey: '',
    fetchImpl: async (url) => {
      if (url.includes('bing.com')) return new Response('bad', { status: 500 })
      return new Response(DDG_HTML, { status: 200 })
    },
  })
  assert.equal(result.engine, 'ddg')
  assert.equal(result.sources.length, 2)
  assert.equal(result.errors[0].engine, 'firecrawl')
  assert.equal(result.errors[1].engine, 'bing')
})

test('runFallback reports every engine failure when all engines fail', async () => {
  await assert.rejects(
    runFallback({
      query: 'DeepSeek Harness',
      maxResults: 10,
      source: 'auto',
      firecrawlApiKey: '',
      fetchImpl: async () => { throw new Error('network down') },
    }),
    /bing.*ddg.*wiki/s,
  )
})

test('formatSearchOutput names the engine and lists sources', () => {
  const text = formatSearchOutput({
    engine: 'bing',
    sources: [{ title: 'DeepSeek Harness', url: 'https://www.deepseek.com/en/harness/', snippet: 'A framework.' }],
    truncated: false,
    errors: [],
  })
  assert.match(text, /External web content follows/)
  assert.match(text, /Engine: bing/)
  assert.match(text, /\[DeepSeek Harness\]\(https:\/\/www\.deepseek\.com\/en\/harness\/\)/)
})

test('runFallback tries Firecrawl first when a key is configured and falls back when it fails', async () => {
  const result = await runFallback({
    query: 'DeepSeek Harness',
    maxResults: 10,
    source: 'auto',
    firecrawlApiKey: 'bad-key',
    fetchImpl: async (url) => {
      if (url.includes('firecrawl.dev')) {
        return new Response(JSON.stringify({ success: false, error: 'HTTP 403: VPN or proxy' }), { status: 403 })
      }
      return new Response(BING_RSS, { status: 200 })
    },
  })
  assert.equal(result.engine, 'bing')
  assert.equal(result.errors[0].engine, 'firecrawl')
  assert.match(result.errors[0].message, /403/)
})

test('parseSearchArgs rejects an empty query and an unknown source', () => {
  assert.throws(() => parseSearchArgs({ query: '   ' }), /query must be a non-empty string/)
  assert.throws(() => parseSearchArgs({ query: 'x', source: 'google' }), /source must be one of/)
})

test('parseSearchArgs applies the configured default result cap', () => {
  assert.deepEqual(parseSearchArgs({ query: 'DeepSeek' }, 7), {
    query: 'DeepSeek',
    maxResults: 7,
    source: 'auto',
  })
})
