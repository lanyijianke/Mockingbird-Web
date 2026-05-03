# AcademyContent 下线 & 数据库迁移记录

> 日期：2026-05-02

## 背景

学社（Academy）功能业务调整，不再需要数据库存储文章内容。后续文章、视频等内容会迁移到其他存储方案。同时数据库服务器从本地迁移到了新的远程服务器。

## 数据库变更

### 服务器迁移

- **旧方案**：Knowledge 库本地直连 `localhost:3306`，Console 库通过 SSH 隧道 `127.0.0.1:3307`
- **新方案**：两个库统一连接到远程服务器 `154.222.29.185:37564`，用户 `grank`

### 表结构变更

| 变更 | 说明 |
|------|------|
| **删除 `AcademyContent` 表** | 学社文章功能下线，不再需要 |
| **新建 `ApiKeys` 表** | Gateway API Key 认证所需，位于 `mockingbird_knowledge` 库 |
| **表名改为 PascalCase** | 新数据库统一使用 PascalCase 命名（如 `Users`、`Prompts`、`ApiKeys`） |

### IntelligenceInsights 字段变更（`mockingbird_console` 库）

以下字段已不存在，业务逻辑已变更：

- `Score` — 已移除
- `ExecutiveSummary` — 已移除
- `ActionLevel` — 已移除
- `SectionsJson` — 已移除
- `SourceArticleCount` — 已移除
- `NarrativeCount` — 已移除
- `Type` 字段从整数编码改为直接存储字符串（`opportunity`、`risk`、`anomaly`、`contradiction`）

### IntelligenceNarratives 字段变更（`mockingbird_console` 库）

- `HeatScore` — 已移除

## Knowledge 项目代码变更

### 删除的文件

- `app/api/academy/content/route.ts` — 学社文章列表 API
- `app/api/academy/content/[slug]/route.ts` — 学社文章详情 API
- `app/academy/page.tsx` — 学社首页
- `app/academy/layout.tsx` — 学社布局（含权限校验）
- `app/academy/content/[slug]/page.tsx` — 学社文章详情页
- `app/NavAcademyLink.tsx` — 导航栏学社入口组件

### 修改的文件

| 文件 | 变更 |
|------|------|
| `app/layout.tsx` | 移除 NavAcademyLink |
| `app/NavAuthButton.tsx` | 移除学社入口按钮 |
| `app/profile/page.tsx` | 移除学社链接 |
| `app/membership/page.tsx` | 移除学社跳转逻辑 |
| `lib/auth/roles.ts` | 移除 `hasAcademyAccess` 函数和 `ACADEMY_ALLOWED_ROLES` |
| `lib/site-config.ts` | 移除 `academyName` 配置 |
| `lib/seo/config.ts` | 移除 `academyName` 配置 |
| `lib/init-schema.ts` | 移除 `AcademyContent` 建表语句 |
| `middleware.ts` | 移除 `/academy` 路由保护 |
| `app/globals.css` | 移除约 200 行学社样式 |
| `.env.example` | 移除 `NEXT_PUBLIC_SITE_ACADEMY_NAME` |
| `tests/unit/layout-nav.test.ts` | 移除学社相关断言 |

## Gateway 项目代码变更

### 删除的文件

- `internal/repository/articles.go` — 文件系统文章仓库

### 修改的文件

| 文件 | 变更 |
|------|------|
| `.env` | 更新数据库连接串，端口改为 5733 |
| `Makefile` | `make run` 自动加载 `.env` |
| `migrations/001_create_api_keys.sql` | 表名 `ApiKeys`，collation `utf8mb4_0900_ai_ci` |
| `internal/config/config.go` | 移除 `ArticlesRootPath` |
| `internal/model/content.go` | 移除 `AcademyArticle`、`Article`、`ArticleManifest` |
| `internal/model/insight.go` | 移除 `Score`、`HeatScore`、`MarketReport` 多余字段，移除 `InsightTypes`/`NarrativePhases` |
| `internal/repository/apikey.go` | 表名改为 `ApiKeys`/`Users` |
| `internal/repository/content.go` | 移除 Academy 相关方法 |
| `internal/repository/insights.go` | 移除不存在的字段，`Type` 改为直接读字符串 |
| `internal/service/content.go` | 移除 Academy 方法 |
| `internal/handler/content.go` | 移除 Academy/Articles 处理器 |
| `cmd/server/main.go` | 移除 articlesRepo 和 articles 路由 |
| `cli/cmd/content.go` | 移除 articles/rankings CLI 命令 |

## 影响范围

- **用户侧**：`/academy` 页面和 API 不再可用，导航栏移除学社入口
- **API 调用方**：Gateway 的 `/v1/content/articles`、`/v1/content/articles/{slug}`、`/v1/content/rankings` 路由已移除
- **数据库**：`AcademyContent` 表已删除，`ApiKeys` 表已新建

## 后续计划

- 文章、视频等内容将迁移到新的存储方案（待定）
- Gateway 后续可能增加 CORS 支持以方便前端直接调用
