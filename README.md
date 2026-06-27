# Agent Arena

**Agent Arena** 是 Platform 厂商运营中台下的 ToC 桌面产品（产品代号 `arena`）。当前版本 **v0.1.0**。

> 养成你的 AI 角色，让他们一起玩规则化社交游戏。

用户可以创建拥有独立人设、口吻与策略倾向的 AI 角色，并发起对局。当前已可用的玩法包括 **狼人杀**、**自定义圆桌讨论**，以及基于圆桌模板创建的 **自建玩法**。

## 产品定位

Agent Arena 面向 AI 角色养成与多 AI 互动对局，不是普通在线多人游戏或单纯聊天室。

与 Platform 的集成（已实现）：

- **账户与登录**：邮箱验证码、密码、微信 OAuth
- **模型服务**：经 Platform 网关调用，本机管理 API Key
- **计费**：钱包充值、用量统计、对局成本估算
- **客户端发版**：对接 `GET /app/client-release/latest`，支持 Windows / macOS 安装包更新

更完整的产品愿景与模块设计见 [`docs/Agent_Arena_产品说明书_V1.1.md`](docs/Agent_Arena_产品说明书_V1.1.md)（含尚未落地的规划内容）。

## 技术栈

- **Electron 39** + **electron-vite** + **electron-builder**
- **Vue 3** + **Naive UI** + **TypeScript**
- 本地数据：主进程 JSON 文件存储（`userData` 下的 Arena store）
- 由 `create-mntools-app` 脚手架生成，已在仓库内独立定制

## 目录结构

```
src/
├── main/              主进程（窗口、IPC、素材包、客户端更新）
├── preload/           预加载桥接（window.api）
├── renderer/src/      Vue 3 渲染层（页面、服务、组件）
└── shared/            跨进程类型与 Arena 共享逻辑

scripts/               素材打包、图标生成、本地安装脚本
docs/                  产品说明、构建发布文档
build/                 应用图标
src/shared/arena/bundled-asset-pack-manifest.json  内置素材清单（随安装包版本发布）
```

主要页面（见 `feature-registry.ts`）：

| 路由 | 说明 |
|------|------|
| `/home` | 首页大厅 |
| `/characters` | 角色库 |
| `/game-modes` | 玩法场景 |
| `/match-records` | 对局记录 |
| `/settings/*` | 设置中心（用户信息、模型服务、钱包、显示与数据管理等） |

## 快速开始

```bash
pnpm install
pnpm dev
```

开发环境下，首次打开 **素材管理** 且本地 `.dev-assets/` 尚无完整素材包时，会按内置清单下载并解压到 `.dev-assets/`。

## 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 开发模式 |
| `pnpm build` | 构建到 `out/` |
| `pnpm build:win` | Windows NSIS 安装包 |
| `pnpm build:mac` | macOS DMG |
| `pnpm typecheck` | Vue / TS 类型检查 |

## 素材策略

安装包内仅保留登录页与壳层必要素材，以及**内置素材清单**。角色立绘等大体积资源**不随安装包分发**，由用户在**首次初始化向导**或**设置中心 → 数据管理**中按内置清单从 OSS 下载 / 载入本地 zip 到 `userData/{appId}/arena-assets/`。

## 数据便携

角色与玩法场景支持 **导入/导出**：

| 能力 | 入口 | 文件格式 |
|------|------|----------|
| 角色导出 | 角色库卡片菜单 / 角色详情侧栏 | `*.arena-character.zip`（含 `character.json` 与 `assets/` 素材） |
| 角色导入 | 角色库工具栏「导入」 | 优先 zip；仍兼容旧版 `*.arena-character.json` |
| 玩法导出 | 玩法详情侧栏「导出」 | `*.arena-mode.json` |
| 玩法导入 | 玩法场景工具栏「导入」 | 同上 |
| 新建玩法 | 玩法场景工具栏「新建玩法」 | 基于圆桌讨论模板创建自建玩法 |

角色素材在初始化、导入或选择素材包时会复制到应用目录 `{userData}/{appId}/arena-assets/characters/{角色ID}/`，运行时展示始终读取该目录；替换素材会直接覆盖安装目录中的对应文件。导出 zip 仅用于迁移与分享，不是运行时素材源。

应用首次启动会自动创建 `{userData}/{appId}/` 应用数据目录（含 `arena/`、`arena-assets/`、`arena-asset-pack/`、`storage/`）。

导出包不含对局记录与钱包数据。完整本机备份可在设置中心「数据管理」中操作。
