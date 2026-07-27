# Site to Single HTML

一个将授权网站、前端项目或生产构建迁移为单个可携带 HTML 文件的 Codex Skill。

目标不是截一张静态页面，也不是重新仿写界面，而是在获得授权的前提下尽量保留原有视觉、客户端路由、交互、响应式布局和可用的离线状态，让交付文件可以直接通过 `file://` 打开。

## 能做什么

- 将 React、Vue、SPA 或静态站点构建产物打包为单文件 HTML
- 内联 CSS、JavaScript、图片、字体、图标、Manifest 和 CSS 资源
- 将 History Router 调整为适合 `file://` 的导航方式
- 审计 API、WebSocket、Worker、iframe、媒体和第三方资源依赖
- 为只读数据提供经过批准的离线 fixture
- 明确禁用支付、上传、登录、写操作等无法离线工作的能力
- 验证路由、资源、控制台错误、网络请求和不同视口布局
- 拒绝隐藏未解决的模块导入和外部运行时依赖

## 工作流程

```text
确认授权与交付范围
        ↓
盘点路由、交互与外部依赖
        ↓
优先获取源码或生产构建
        ↓
调整路由和离线数据行为
        ↓
内联资源并生成单文件 HTML
        ↓
停止开发服务器，通过 file:// 完整验证
```

### 1. 建立迁移约定

先确认：

- 网站或代码仓库的授权范围
- 必须保留的路由、页面、交互和响应式尺寸
- 是否要求完全离线
- 服务端能力在离线状态下应该使用 fixture、快照还是明确禁用
- 输出文件位置和验收标准

### 2. 审计来源

对 URL 或构建入口运行：

```bash
node scripts/audit-site.mjs \
  --input <url-or-index.html> \
  --json <audit.json>
```

审计会帮助识别页面资源、路由和潜在的外部依赖。对于真实网站，还需要配合浏览器检查菜单、弹窗、表单、控制台和网络活动。

### 3. 打包生产构建

先确保项目的生产构建可以正常运行，再执行：

```bash
node scripts/pack-single-html.mjs \
  --input <dist/index.html> \
  --output <output.html>
```

处理已授权的公开 URL 时，可以显式允许网络读取：

```bash
node scripts/pack-single-html.mjs \
  --input <https://example.com> \
  --output <output.html> \
  --allow-network
```

打包器默认拒绝未解决的模块导入和外部运行时资源，不会为了生成文件而静默忽略缺失内容。

### 4. 验证交付文件

至少执行以下检查：

1. 停止原项目的开发服务器。
2. 直接通过 `file://` 打开输出文件。
3. 访问所有要求保留的路由。
4. 测试主要交互、返回、前进和刷新。
5. 检查桌面与窄屏布局。
6. 检查控制台错误和残留网络请求。
7. 搜索 `localhost`、源码绝对路径、密钥和未授权外部域名。
8. 将相同状态下的页面截图与来源进行比较。

## 安装为 Codex Skill

```bash
git clone https://github.com/XuEimy/site-to-single-html.git \
  ~/.codex/skills/site-to-single-html
```

重启 Antigravity / Codex，让客户端重新发现 Skill。

## 调用示例

```text
$site-to-single-html 把这个我有权使用的 React 项目迁移成一个可直接
file:// 打开的单文件 HTML，保留全部路由，并验证没有 localhost 依赖。
```

```text
$site-to-single-html 先审计这个授权网站的路由、资源和在线 API，
列出哪些功能可以离线迁移，暂时不要复制受保护资源。
```

## 三种迁移模式

| 模式 | 使用场景 | 策略 |
| --- | --- | --- |
| 有源码的前端项目 | 可以访问仓库和构建流程 | 优先运行原项目生产构建，再做最小路由与离线调整 |
| 静态或多页面源码 | 已有 HTML、CSS、JS 和页面资源 | 收集页面与资源，统一客户端导航后打包 |
| 只有网站访问权限 | 没有源码，但已获得迁移授权 | 先盘点页面；受保护资源仍需明确许可，不绕过访问限制 |

详细规则见 [`references/migration-modes.md`](references/migration-modes.md)。

## 离线能力边界

| 依赖类型 | 建议处理方式 |
| --- | --- |
| CSS、JS、图片、字体 | 内联为文本或 Data URI |
| 展示所需的只读 API | 使用经批准、去敏的 fixture |
| 登录、支付、上传和数据写入 | 禁用并提供明确的本地模式提示 |
| WebSocket、流式状态 | 使用标注清楚的快照或不可用状态 |
| 跨域 iframe、受保护媒体 | 获得许可后保留外链，否则报告不支持 |

单文件不应向用户直接展示 `Failed to fetch` 等原始网络错误。

## 安全边界

- 仅迁移用户拥有或明确授权的网站与资源
- 不绕过登录、付费墙、DRM、反爬或访问控制
- 不嵌入 Cookie、令牌、个人数据或私有 API 响应
- 不把 fixture 或静态快照描述成真实后端能力
- 第三方字体、图片、视频和代码仍受各自许可证约束
- 无法保留的路由、功能和在线依赖必须明确报告

## 项目结构

```text
site-to-single-html/
├── SKILL.md
├── agents/
│   └── openai.yaml
├── references/
│   ├── migration-modes.md
│   ├── router-recipes.md
│   └── verification-checklist.md
└── scripts/
    ├── audit-site.mjs
    ├── pack-single-html.mjs
    └── pack-single-html.test.mjs
```

## 测试

```bash
node --test scripts/pack-single-html.test.mjs
```

测试通过只代表打包工具行为符合预期。真实交付仍需在停止开发服务器后，通过 `file://` 完成路由、交互、控制台和网络验证。
