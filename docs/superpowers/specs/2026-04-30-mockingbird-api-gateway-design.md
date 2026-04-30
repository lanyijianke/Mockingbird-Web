# Mockingbird API Gateway 设计文档

> 日期: 2026-04-30
> 状态: 已批准

## 一、背景与目标

Mockingbird V2 是一个 .NET 情报分析引擎（MySQL，40+ 表，知识图谱 + AI 洞察），Mockingbird V2-Knowledge 是一个 Next.js 内容展示站（SQLite，提示词 + 文章 + 会员体系）。目前两套系统各自为政，数据能力没有对外暴露。

**目标**：构建一套独立的 API 服务 + CLI 工具 + Skill 系统，将两个项目的数据能力（知识图谱、AI 洞察、内容库、搜索）统一对外提供，通过 API Key 认证（与会员体系绑定，付费使用）。

## 二、整体架构

```
┌─────────────────────────────────────────────────┐
│                    用户终端                       │
│  ┌──────────────┐  ┌──────────────┐             │
│  │  AI 工具      │  │  开发者终端   │             │
│  │ (Claude/Cursor)│  │  (CLI 命令)  │             │
│  └──────┬───────┘  └──────┬───────┘             │
│  SKILL.md          CLI (Go, cobra)              │
└─────────┼─────────────────┼─────────────────────┘
          │                 │
          ▼                 ▼
┌─────────────────────────────────────────────────┐
│          API Gateway (Go, 独立服务)               │
│                                                  │
│  Key 验证 → 频率限制 → 路由 → 直连数据库         │
│                                                  │
│  /v1/graph/*     知识图谱                        │
│  /v1/insights/*  AI 洞察与叙事                   │
│  /v1/content/*   内容库                          │
└──────────┬────────────────────┬──────────────────┘
           │                    │
           ▼                    ▼
   ┌──────────────┐  ┌──────────────┐
   │ MySQL        │  │ MySQL        │
   │ (V2 引擎库)  │  │ (Knowledge库)│
   └──────────────┘  └──────────────┘
```

### 关键设计决策

1. **Gateway 直连数据库**，不转发已有内部 API。现有内部 API 是给 Blazor/Next.js 用的，格式不适合对外。Gateway 自己写 SQL 查询，从头设计对外 API。
2. **两个 MySQL 数据库**。Knowledge 站后续从 SQLite 迁移到 MySQL，与 V2 引擎统一数据库类型。Gateway 分别连接两个库。
3. **Gateway 只做数据服务**，不存业务数据（除了 api_keys 表）。

## 三、子系统清单

| 组件 | 技术栈 | 职责 | 仓库 |
|------|--------|------|------|
| API Gateway | Go | 对外 API，Key 验证，限流，直连 MySQL | 新仓库 |
| CLI | Go (cobra) + npm 包装 | 命令行工具，单二进制分发 | CLI 目录在 Gateway 仓库内 |
| Skill | SKILL.md | 教 AI 工具调用 CLI | 同仓库 skills/ 目录 |
| Key 管理页 | Knowledge 站新增页面 | 用户生成/管理 API Key | Knowledge 仓库 |

## 四、API Key 与认证体系

### 数据模型

```sql
CREATE TABLE api_keys (
  id              VARCHAR(36) PRIMARY KEY,
  user_id         VARCHAR(36) NOT NULL,
  key_hash        VARCHAR(64) NOT NULL,     -- SHA-256，不存明文
  key_prefix      VARCHAR(6)  NOT NULL,     -- 前6位，用于识别和展示
  name            VARCHAR(100),             -- 用户起的别名，如 "我的 Mac"
  status          VARCHAR(10) DEFAULT 'active',  -- active / revoked
  last_used_at    DATETIME,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Key 生命周期

```
用户在 Knowledge 站登录
  → 成为会员（邀请码兑换，已有流程）
  → 个人页点击「生成 API Key」
  → 前端生成 mk_xxxxxxxxxxxx 格式的 Key
  → 存入 api_keys 表（SHA-256 哈希后存储）
  → 用户拿到明文 Key（仅此一次展示）
  → CLI 配置: mockingbird auth login --key mk_xxxx
  → 存入 ~/.mockingbird/credentials（文件权限 600）
```

### Key 验证流程

每次 API 请求：

1. 从 Header `Authorization: Bearer mk_xxxx` 取 Key
2. SHA-256 哈希后查 api_keys 表
3. 检查 status == active
4. 关联查 users 表，检查会员是否未过期（role + membership_expires_at）
5. 检查频率限制
6. 全部通过 → 处理请求；任一失败 → 返回对应错误码

会员到期 → Key 自动失效；续费后自动恢复。不需要手动操作 Key。

### CLI 认证命令

```
mockingbird auth login --key mk_xxxx    # 配置 API Key
mockingbird auth status                 # 查看认证状态和会员到期时间
mockingbird auth logout                 # 清除本地凭证
```

凭证存储：统一存入 `~/.mockingbird/credentials`，文件权限 600。不做系统密钥链回退，一种方式，简单清楚。

## 五、MVP 接口设计

### 统一响应格式

```json
{
  "data": [...],
  "pagination": { "page": 1, "page_size": 20, "total": 156 },
  "meta": { "cached": true, "latency_ms": 23 }
}
```

错误响应：

```json
{
  "error": { "code": 401, "message": "Invalid API key" }
}
```

### 接口清单

#### 1. 知识图谱 `/v1/graph/*`

数据源：V2 引擎 MySQL（IntelligenceEntities, IntelligenceEntityRelations, IntelligenceCommunities）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /v1/graph/entities | 搜索实体（人物、公司、概念），支持 `q`, `type`, `page`, `page_size` |
| GET | /v1/graph/entities/:id | 实体详情（名称、描述、类型、别名） |
| GET | /v1/graph/entities/:id/relations | 实体的关系网络（关联实体 + 关系类型） |
| GET | /v1/graph/subgraph | 多实体子图查询，参数 `entity_ids=a,b,c`，返回关系拓扑 |

#### 2. AI 洞察与叙事 `/v1/insights/*`

数据源：V2 引擎 MySQL（IntelligenceInsights, IntelligenceNarratives, IntelligenceMarketReports）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /v1/insights | AI 洞察列表，支持 `topic`, `page`, `page_size` |
| GET | /v1/insights/:id | 洞察详情 |
| GET | /v1/narratives | 趋势叙事列表，支持 `topic`, `page`, `page_size` |
| GET | /v1/reports | 市场报告列表，支持 `type`, `page`, `page_size` |

#### 3. 内容库 `/v1/content/*`

数据源：Knowledge MySQL（Prompts, 文章通过文件系统 manifest）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /v1/content/prompts | 提示词搜索，支持 `category`, `q`, `page`, `page_size` |
| GET | /v1/content/prompts/:id | 提示词详情 |
| GET | /v1/content/articles | 文章搜索，支持 `category`, `q`, `page`, `page_size` |
| GET | /v1/content/articles/:slug | 文章详情 |
| GET | /v1/content/rankings | 排行榜数据，支持 `type` (github/producthunt/skills-trending/skills-hot) |

## 六、限流与并发控制

单层限流规则，不分会员等级：

| 维度 | 限制 | 实现方式 | 超限响应 |
|------|------|---------|---------|
| 全局并发 | 200 个同时处理 | Go buffered channel 信号量 | 503 Service Unavailable |
| 单 IP | 300 次/分钟 | 内存滑动窗口计数器 | 429 + Retry-After |
| 单 Key | 60 次/分钟 | 内存滑动窗口计数器 | 429 + Retry-After |

MySQL 连接池上限 50 个连接（Go `database/sql` 自带）。

超限响应格式：

```json
{
  "error": {
    "code": 429,
    "message": "Rate limit exceeded",
    "retry_after_seconds": 45
  }
}
```

后续压力大时再按会员等级拆分限流规则。

## 七、CLI 工具

### 技术方案

- Go 编译为单二进制
- cobra 框架处理命令路由
- npm 包装分发（`npm install -g @mockingbird/cli`，postinstall 下载对应平台二进制）
- 同时提供 GitHub Releases 直接下载

### 命令结构

```
mockingbird
├── auth
│   ├── login --key mk_xxxx    # 配置 API Key
│   ├── status                  # 查看认证状态
│   └── logout                  # 清除本地凭证
├── graph
│   ├── entities -q "OpenAI"    # 搜索实体
│   ├── entity <id>             # 实体详情
│   └── relations <id>          # 实体关系网络
├── insights
│   ├── list --topic AI         # 洞察列表
│   ├── narratives              # 趋势叙事
│   └── reports                 # 市场报告
├── content
│   ├── prompts -q "写作"       # 搜索提示词
│   ├── articles -q "Claude"    # 搜索文章
│   └── rankings --type github  # 排行榜
└── config
    └── set-api-url <url>       # 自定义 Gateway 地址（私有部署用）
```

### 输出格式

- 默认：表格（人类可读）
- `--json`：JSON（程序调用）
- `--csv`：CSV（导入用）

## 八、Skill 系统

### 分发方式

```bash
npx skills add mockingbird/cli -y
```

### MVP Skill 结构

```
skills/
└── mockingbird-data/
    ├── SKILL.md              # 主技能文件
    └── references/
        └── api-reference.md  # API 完整文档
```

### SKILL.md 内容

- 技能名称、描述、依赖（bins: ["mockingbird"]）
- 认证说明（auth login --key）
- 全部命令速查表
- 使用场景和工作流指导

### 后续扩展

- `mockingbird-graph` — 专注知识图谱深度分析
- `mockingbird-content` — 专注内容库检索
- `mockingbird-workflow-daily-brief` — 每日 AI 情报简报

MVP 先做一个，跑通再加。

## 九、部署方案

### 域名与路由

单域名 + 子域名，Nginx 反向代理：

```
api.mockingbird.com       → Go Gateway (端口 8080)
mockingbird.com           → Knowledge 站 Next.js (端口 5046)
console.mockingbird.com   → V2 引擎 .NET Blazor (端口 5299)
```

DNS 配置：同一 IP 的三条 A 记录，零额外成本。

### 单机部署架构

```
用户请求 → Nginx (443/80)
              ├─ api.mockingbird.com     → localhost:8080 (Go Gateway)
              ├─ mockingbird.com         → localhost:5046 (Next.js)
              └─ console.mockingbird.com → localhost:5299 (.NET)
```

所有服务运行在同一台服务器上。

## 十、Gateway 项目结构

```
mockingbird-api/
├── cmd/
│   └── server/main.go         # 服务入口
├── internal/
│   ├── middleware/
│   │   ├── auth.go            # API Key 验证
│   │   ├── ratelimit.go       # 限流（IP + Key + 全局并发）
│   │   └── logger.go          # 请求日志
│   ├── handler/
│   │   ├── graph.go           # /v1/graph/* 处理器
│   │   ├── insights.go        # /v1/insights/* 处理器
│   │   └── content.go         # /v1/content/* 处理器
│   ├── service/
│   │   ├── graph.go           # 知识图谱查询逻辑
│   │   ├── insights.go        # 洞察/叙事/报告查询逻辑
│   │   └── content.go         # 提示词/文章/排行榜查询逻辑
│   ├── repository/
│   │   ├── v2db.go            # V2 引擎 MySQL 连接和数据访问
│   │   └── knowledge.go       # Knowledge MySQL 连接和数据访问
│   └── model/
│       ├── entity.go          # 实体、关系模型
│       ├── insight.go         # 洞察、叙事、报告模型
│       └── content.go         # 提示词、文章、排行榜模型
├── config/
│   └── config.go              # 两个数据库连接配置、限流参数
├── migrations/
│   └── 001_create_api_keys.sql  # api_keys 表迁移
├── skills/
│   └── mockingbird-data/
│       ├── SKILL.md
│       └── references/api-reference.md
└── cli/                       # CLI 工具（同仓库）
    ├── main.go
    ├── cmd/                   # cobra 命令
    └── internal/              # CLI 内部逻辑
```

## 十一、Knowledge 站改动

需要在 Knowledge 站新增以下功能：

1. **api_keys 数据库表** — 见第四节 SQL
2. **API Key 管理页面** `/profile/keys`
   - 生成新 Key（前端生成 mk_ 前缀 + 随机字符串，SHA-256 哈希后存库）
   - Key 列表（显示前6位、名称、创建时间、最后使用时间、状态）
   - 吊销 Key
3. **API 路由** `/api/keys`
   - POST /api/keys — 生成 Key（需登录 + 有效会员）
   - GET /api/keys — 查看自己的 Key 列表
   - DELETE /api/keys/:id — 吊销 Key
