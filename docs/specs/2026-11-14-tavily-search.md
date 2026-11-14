> 由 /grill-me 于 2026-11-14 生成；后续实现以此文件为准。

# 需求确认摘要：把 Tavily 搜索加入 free_search

【目标】
给 `free_search` 增加 Tavily 作为第五个免费搜索源：有免费 Key 用 Key、没 Key 先试 keyless，失败自动回退；让插件在 Firecrawl 不可用时多一层高质量来源。

【范围】
会动：`dsh-free-search-mini/` 内的：
- `lib/engines.js`（新增 Tavily 请求与解析、接入回退链）
- `index.js`（`source` 枚举新增 `tavily`；Config 新增 `tavilyApiKey` / `tavilyApiKeyEnv`）
- `client.js`（配置页多一个 Tavily Key 输入框，含保存 / 清除 Key）
- `locale/en.json`、`locale/zh.json`、`README.md` 文案
- `test/engines.test.js`、`test/client.test.js`（新增回归测试）
- 在功能分支 `feature/tavily-search` 上开发；**验收合格后**才合入 `main` 并推送 GitHub 仓库 `aicywu/dsh-free-search-mini`（用户 2026-11-14 确认）

不动：
- `free_search` 工具名与参数形状（只给 `source` 多一个可选值 `tavily`）
- 现有输出格式（`engine` / `sources` / `truncated` / `errors`）
- Firecrawl 现有行为
- 插件页「只有一处配置区」的结构（此前已特意精简过）
- 现有依赖（不引入任何新依赖 / SDK）
- DSH 内置 `web_search` / `web_fetch`、代理与 Clash 配置

【关键决定】
1. `auto` 回退顺序：**Firecrawl → Tavily → Bing RSS → DuckDuckGo HTML → Wikipedia**。
2. Tavily 认证：有 Key 用 `Authorization: Bearer tvly-...`；没 Key 用请求头 `x-tavily-access-mode: keyless`。配置字段与 Firecrawl 对称：`tavilyApiKey`（`role('secret')`、`volatile`）、`tavilyApiKeyEnv`（默认 `TAVILY_API_KEY`，支持凭据中心 / 环境变量）。
3. **不使用** Tavily 的 `answer`（综合答案）字段：只把 `results[]` 映射成 `title` / `url` / `snippet` 来源，输出格式保持不变，避免改动输出 schema 与渲染，也避免用「别人写好的总结」带偏 Agent。
4. 失败一律自动换下一个源，**包括显式 `source: "tavily"`**（与现有 `source: "firecrawl"` 行为一致）；额度耗尽(429)、Key 错(401)、无结果、网络失败都算失败，并在结果 `Fallbacks` 中注明原因。
5. 工作流：在功能分支开发 → 全部测试绿 + 聊天实测合格 → 才合入 `main` 并推送 GitHub。验收不通过不合入。

【验证方式】
聊天里实测两次（用户选择）：
1. 让 Agent 用 `free_search` 搜一个词，看到结果里写着 `Engine: tavily` 且带链接。
2. 故意把 Tavily Key 填错，确认自动换到 Bing，并注明 tavily 失败。

实现时同步跑 `node --test`，保证原有测试 + 新增测试全绿。

【我仍不确定的】
- 无。GitHub 推送时机已由用户确认：验收合格后才合入 `main` 并推送。
- Tavily 的 Bearer 认证、keyless 请求头、`results[]` 字段均已按官方文档与本机实测查证。

---

## 问题与回答要点

| # | 问题 | 用户回答 / 查证结论 |
|---|---|---|
| 1 | 目标确认：把 Tavily 作为第五个免费源加入 `free_search`，零成本优先，参与自动回退链，也支持显式 `source` 指定 | **正确，就是这个意思** |
| 2 | Tavily 在 `auto` 链里排在哪？ | **Firecrawl → Tavily → Bing → DDG → Wiki**（两个 API 源在最前） |
| 3 | Tavily 的 keyless 和免费 Key 怎么处理？ | **Key 优先，没 Key 试 keyless**；插件页多一个 Tavily Key 输入框（含保存/清除） |
| 4 | Tavily 的综合答案 `answer` 要不要用？ | 用户表示是计算机小白、不懂 Agent，把决策交回；我用大白话解释后 **按推荐：不用 answer，只保留链接+摘要，格式统一** |
| 5 | 明确指定「用 tavily 搜」但 tavily 不行时怎么办？ | **自动换下一个源**（和 Firecrawl 一致，避免重蹈「填错 Key 就整个搜不了」的覆辙） |
| 6 | 这次改动哪些东西不能碰？ | **只加、不改、不加依赖**：不装新依赖/SDK、不改输出格式、不改 Firecrawl 行为、插件页仍只有一处配置区 |
| 7 | 怎么验收？ | **聊天里实测两次**：正常搜到 `Engine: tavily`；填错 Key 后自动回退并注明失败 |

### 只读查证（不写入任何文件）

- 本机实测 `POST https://api.tavily.com/search`：
  - 带 `x-tavily-access-mode: keyless` → **HTTP 200**，`results[]` 含 `url` / `title` / `content`。
  - 不带该头 → **HTTP 401** `Unauthorized: missing or invalid API key.`
  - 昨日同一机器曾测到 **429 `daily_cap_reached`**，说明 keyless 有匿名日额度、会被耗尽；因此失败回退是必须的，不是可选项。
- [Tavily Search 官方文档](https://docs.tavily.com/documentation/api-reference/endpoint/search)：
  - 有 Key：`Authorization: Bearer tvly-YOUR_API_KEY`（`bearerAuth`）。
  - 请求体最小字段：`query`（必填）、`max_results`（0–20）。
  - `include_answer` 默认 `false`，所以默认响应 `answer` 为 `null`；忽略该字段即可。
  - 响应 `results[]`：`title` / `url` / `content` / `score` 等；`answer` 仅在显式开启时返回。

### 用户背景（实现时请用大白话沟通）

用户自述是计算机小白、不懂 Agent；这个插件是给 Agent 用的。技术决策由我给出明确默认值并解释理由，不要抛开放式技术选项。
