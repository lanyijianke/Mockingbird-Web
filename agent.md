# Mockingbird_Web Agent Guide

本文档只作用于 `/Users/grank/Mockingbird_V2/Mockingbird_Web`，用于补充根目录 [AGENT.md](/Users/grank/Mockingbird_V2/AGENT.md) 的全仓规则。

优先级：
- 用户明确指令
- 本文件
- 根目录 `AGENT.md`

## 1. 子项目定位

`Mockingbird_Web` 是 Mockingbird 的内容展示子站，当前是：
- `Next.js 16` App Router
- `React 19`
- `TypeScript`
- Node runtime 为主，不是 Edge-first 项目

它当前承载 3 类核心内容：
- 文章：`/ai/articles/*`、`/finance/articles/*`
- 提示词：`/prompts/*`
- 热榜：`/rankings/*`

## 2. 当前真相源

在这个子项目里，以下文件优先级最高：
- `package.json`
- `README.md`
- `next.config.ts`
- `instrumentation.ts`
- `lib/jobs/scheduler.ts`
- `lib/db.ts`
- `lib/init-schema.ts`
- `lib/articles/*`
- `lib/services/*`
- `lib/cache/*`
- `lib/seo/*`
- `app/api/**/*`

如果旧文档、注释、口头约定与这些文件冲突，以代码为准。

## 3. 运行与命令事实

当前固定命令：

```bash
cd Mockingbird_Web
npm run dev
npm run lint
npm run test
npm run build
```

当前开发端口固定为：
- `5046`

来源：
- `package.json` 里的 `dev: next dev -p 5046`

提交前的最小质量闸门：
- `npm run lint`
- `npm run test`
- `npm run build`

## 4. 运行时边界

### 4.1 调度器

这个项目有真实后台调度器，不是纯静态站。

调度器启动方式：
- `instrumentation.ts`
- 在 Node runtime 下启动时自动调用 `startScheduler()`

当前只有 2 个 node-cron 任务：
- `PromptSync`
  - 默认 cron：`30 */1 * * * *`
  - 实际内容：README/source 提示词同步
- `RankingSync`
  - 默认 cron：`0 */2 * * *`
  - 实际内容：刷新排行榜缓存

如果缓存、提示词导入、热榜更新表现异常，优先检查：
- `lib/jobs/scheduler.ts`
- `app/api/jobs/route.ts`
- `instrumentation.ts`

### 4.2 Node-only 约束

下列能力都要求 Node runtime：
- `better-sqlite3`
- 本地文件系统读取
- `node-cron`
- 排行榜抓取

因此：
- 使用这些能力的 Route Handler 必须保持 `runtime = 'nodejs'`
- 不要把相关逻辑误搬到 Edge runtime

## 5. 数据边界

### 5.1 SQLite 只承载部分数据

当前 SQLite 由 `lib/db.ts` 通过 `better-sqlite3` 管理，默认路径：
- `./data/knowledge.db`

当前真正落 SQLite 的核心是：
- `Prompts`
- `SystemLogs`

### 5.2 文章不是从 SQLite 读取

文章主数据源不是数据库，而是本地内容仓库。

文章读取链路是：
- `ARTICLE_LOCAL_SOURCES`
- `lib/articles/source-config.ts`
- `lib/articles/article-directory.ts`
- `lib/services/article-service.ts`

每个文章源要求：
- 根目录有 `manifest.json`
- `articles/drafts/<slug>/index.md`：翻译完成、待确认
- `articles/published/<slug>/index.md`：确认后正式发布
- `articles/{drafts,published}/<slug>/images/*`

文章状态机约定：
- 新文章先写入 `articles/drafts/`
- 用户预览确认后，用 `git mv` 移到 `articles/published/`
- 当前网站仍读取 `manifest.json` 作为索引，只展示 `status: "published"` 的文章
- 移动目录时必须同步更新 `manifest.json` 的 `contentPath` 和 `status`

不要再把文章列表或文章详情实现成“先查 SQLite 的 Articles 表”。

### 5.3 一个重要事实

`lib/init-schema.ts` 当前会在初始化阶段显式执行遗留清理：
- `dropLegacyTables(db)`
- 其中包含 `DROP TABLE IF EXISTS Articles`

这意味着：
- 当前系统明确不依赖 SQLite 的 `Articles` 表
- 如果未来要重新引入文章数据库化，必须先移除这段 legacy cleanup，再改服务层

### 5.4 Finance 文章为空时不要误判

`/finance/articles` 是否有内容，取决于 `ARTICLE_LOCAL_SOURCES` 是否真的配置了 finance 源。

因此：
- Finance 列表为空，先查内容源配置
- 不要默认把它判定为页面 bug

## 6. SEO 与站点绝对地址

SEO 基础配置统一从 `lib/seo/config.ts` 读取。

两个关键环境变量：
- `SITE_URL`
- `SEO_CAN_INDEX`

当前事实：
- canonical
- robots
- sitemap
- JSON-LD 绝对地址
- Open Graph / Twitter 基础站点地址

都应从 `SITE_URL` 推导，不要再硬编码域名。

索引开关由 `SEO_CAN_INDEX` 控制：
- `true`：允许索引
- `false`：默认走不可索引策略

做 SEO 改动时，优先检查：
- `lib/seo/config.ts`
- `lib/seo/metadata.ts`
- `lib/seo/schema.tsx`
- `lib/seo/internal-links.ts`
- `lib/services/sitemap-service.ts`
- `app/robots.ts`
- `app/sitemap.xml/route.ts`

## 7. 管理接口与鉴权

当前管理接口不是公开匿名写接口。

重点接口：
- `POST /api/jobs?action=start`
- `POST /api/jobs?action=stop`
- `POST /api/jobs?action=trigger-prompt-sync`

鉴权依赖：
- `KNOWLEDGE_ADMIN_TOKEN`
- 或兼容变量 `ADMIN_API_TOKEN`

未配置或 token 不正确时，优先按鉴权问题排查，不要先怀疑业务逻辑。

## 8. 缓存与性能

统一缓存实现位于：
- `lib/cache/*`

排行榜缓存相关实现位于：
- `lib/services/ranking-cache.ts`

做缓存类修改时，先确认：
- 是否已经有统一 cache policy
- 是否会影响调度器预热
- 是否会影响页面缓存策略与 SEO 页面一致性

不要重新引入分散、互不兼容的临时缓存。

## 9. 修改原则

在这个子项目里，优先遵守这些具体原则：
- 改文章能力时，先看本地内容源链路，不要先碰数据库
- 改提示词能力时，先看 SQLite、CSV 导入、GitHub README 同步链路
- 改热榜能力时，先看抓取器、缓存、调度器和页面降级逻辑
- 改 SEO 时，优先复用共享 metadata/schema/helper，不要页面里各写一套
- 改 API Route 时，先判断它是否必须是 Node runtime

## 10. 完成前验证

只要改了 `Mockingbird_Web` 代码，默认至少执行：

```bash
cd Mockingbird_Web
npm run lint
npm run test
npm run build
```

如果改动涉及 SEO、robots、sitemap、管理接口或调度器，建议额外检查：

```bash
curl -s http://localhost:5046/robots.txt
curl -s http://localhost:5046/sitemap.xml
curl -i -X POST "http://localhost:5046/api/jobs?action=start"
```
