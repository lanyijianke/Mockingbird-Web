# Mockingbird Knowledge Web

Knowledge Web 是 Mockingbird 的知识展示子站（Next.js 16），负责文章、提示词、排行榜的检索与展示。

## 1. 本地运行

前置要求：
- Node.js 20+
- npm 10+
- 媒体同步/压缩任务需要系统安装 `ffmpeg`、`yt-dlp`、`cwebp`（Ubuntu 包名通常为 `ffmpeg`、`yt-dlp`、`webp`）

启动：

```bash
cd Mockingbird_Web
npm install
npm run dev
```

默认端口：`5046`。

## 2. 质量闸门

提交前至少执行：

```bash
cd Mockingbird_Web
npm run lint
npm run test
npm run build
```

## 3. 关键环境变量

| 变量名 | 用途 | 默认值 |
|---|---|---|
| `SITE_URL` | 站点绝对地址，用于 canonical / robots / sitemap / JSON-LD | `http://localhost:5046` |
| `SQLITE_DB_PATH` | 本地 SQLite 数据库路径 | `./data/knowledge.db` |
| `ARTICLE_LOCAL_SOURCES` | 本地文章源配置(JSON 数组)，运行时读取 manifest 与 Markdown；当前只发布 `articles/published/` 内容 | 空 |
| `CONTENT_PROMPTS_MEDIA_DIR` | 提示词图片/视频下载后的本地媒体目录；生产环境应指向 shared 持久化目录 | `./public/content/prompts/media` |
| `KNOWLEDGE_ADMIN_TOKEN` | 管理接口鉴权 token（优先） | 空 |
| `ADMIN_API_TOKEN` | 管理接口鉴权 token（兼容回退） | 空 |
| `ROBOTS_BLOCK_BAIDU` | 是否屏蔽 Baidu 爬虫（`true/false`） | `false` |
| `MEDIA_DOWNLOAD_MAX_BYTES` | 媒体下载最大字节数（SSRF/资源防护） | `52428800` |
| `JOB_PROMPT_SYNC_CRON` | 提示词同步 cron | `30 */1 * * * *` |
| `JOB_RANKING_SYNC_CRON` | 排行榜同步 cron | `0 */2 * * *` |

`ARTICLE_LOCAL_SOURCES` 示例：

```json
[
  {
    "site": "ai",
    "source": "web-article",
    "rootPath": "/data/content/web-article",
    "manifestPath": "manifest.json"
  },
  {
    "site": "finance",
    "source": "finance-digest",
    "rootPath": "/data/content/finance-digest",
    "manifestPath": "manifest.json"
  }
]
```

每个本地内容仓库需提供：

- 根目录 `manifest.json`
- `articles/drafts/<slug>/index.md`：翻译完成、待确认的草稿
- `articles/published/<slug>/index.md`：已确认、正式发布的文章
- `articles/{drafts,published}/<slug>/images/*`

文章状态以目录为准：新文章先写入 `articles/drafts/`，确认发布后通过 `git mv` 移到 `articles/published/`。当前网站仍以 `manifest.json` 作为文章索引，只展示 `status: "published"` 的条目；移动文章目录时必须同步更新 manifest 里的 `contentPath` 与 `status`，避免索引和文件位置不一致。

## 4. 管理接口安全约束

管理写操作默认受 token 保护：
- `POST /api/jobs?action=start|stop|trigger-prompt-sync`
- `POST /api/logs?action=purge`

鉴权方式（任选其一）：
- Header: `x-admin-token: <token>`
- Header: `authorization: Bearer <token>`

失败语义：
- 未配置 token：`503`
- 缺少 token：`401`
- token 错误：`403`

## 5. SEO 规则基线

- 首页、文章页、提示词页、排行榜页统一复用共享 metadata builder，保证 `title` / `description` / `canonical` / Open Graph / Twitter 口径一致。
- 列表页 canonical 采用规范参数路径：保留 `category/page`，不包含 `q`。
- 搜索参数页（`q`）统一 `noindex,follow`。
- 提示词详情页输出对象级 `CreativeWork` JSON-LD；文章详情页输出 `Article`；列表页和专题落地页输出 `CollectionPage` + `ItemList` + `BreadcrumbList`。
- 新增可索引专题落地页：
  - `/prompts/categories/[category]`
  - `/ai/articles/categories/[category]`
- 模板级内链至少覆盖：
  - 文章 -> 分类专题 / 提示词专题 / 热榜
  - 提示词 -> 同类专题 / 相关文章 / 热榜
  - 热榜 -> 文章专题 / 提示词专题 / 其他热榜
- `sitemap.xml` 动态页 `lastModified` 使用内容真实更新时间（`UpdatedAt`/`CreatedAt`）。
- Baidu 抓取策略通过 `ROBOTS_BLOCK_BAIDU` 环境变量控制。

## 6. 运维巡检

建议巡检项：

```bash
# robots 与 sitemap
curl -s http://localhost:5046/robots.txt
curl -s http://localhost:5046/sitemap.xml

# 管理接口鉴权（期望 401/403/503 之一）
curl -i -X POST "http://localhost:5046/api/jobs?action=start"

# 带 token 的管理接口调用（token 替换为真实值）
curl -i -X POST "http://localhost:5046/api/jobs?action=start" -H "x-admin-token: <token>"
```

## 7. 常见故障排查

1. `build` 失败且提示运行时冲突：检查 API Route 是否声明 `runtime = 'nodejs'`，并确认未把 Node-only 依赖带入 Edge。
2. 管理接口始终 503：确认 `KNOWLEDGE_ADMIN_TOKEN` 或 `ADMIN_API_TOKEN` 已配置。
3. 排行榜页面构建期抓取失败：受网络限制时会降级记录错误日志，不应阻断构建。

## 8. 外部平台接入清单（Search Console / Bing）

完整流程与 repo 内检查脚本见 `docs/search-platform-operations.md`。
每周观察结果统一记录到 `docs/search-platform-observation-log.md`。

Google Search Console / Bing Webmaster Tools 的站点验证与 sitemap 提交只能在真实域名上线后手动完成，仓库内脚本不会尝试代替这些线上操作。

### 8.1 Google Search Console

1. 添加资源：当前部署 `SITE_URL` 对应的真实域名（推荐 Domain Property）。
2. 在生产环境完成域名验证：DNS TXT（优先）或批准的验证方式。
3. 上线后手动提交站点地图：`SITE_URL + /sitemap.xml`。
4. 检查覆盖率与抓取统计：重点关注「已编入索引」「抓取异常」。
5. 抽样 URL 检查：文章页、提示词场景页、热榜专题页是否可抓取。

### 8.2 Bing Webmaster Tools

1. 添加站点并完成验证（可复用生产环境 DNS/Meta 验证）。
2. 上线后手动提交站点地图：`SITE_URL + /sitemap.xml`。
3. 打开 URL Inspection 与 Site Explorer 抽样巡检提示词场景页、热榜专题页和文章页。
4. 关注抓取错误、索引覆盖和回源状态码异常。

### 8.3 指标观察建议（每周）

1. 收录量：Indexed Pages 周环比。
2. 抓取健康：5xx/4xx、robots 屏蔽误伤、sitemap 报错。
3. 搜索表现：Top Queries、CTR、平均排名变化。
4. 重点页面：`/ai/articles/*`、`/finance/articles/*`、`/prompts/scenarios/*`、`/rankings/topics/*` 抽样监控，并写入 observation log。
