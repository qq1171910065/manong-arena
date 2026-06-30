# 构建与发布

## 命令

```bash
pnpm pack:assets              # 打包初始素材 zip → .tmp/asset-pack/，更新内置 manifest
pnpm install:asset-pack-local # 将 zip 复制到 userData 安装目录（本地 dev 测试）
pnpm build                    # electron-vite → out/
pnpm build:unpack             # 当前平台未打包目录 → dist/
pnpm build:win                # Windows NSIS 安装包（不含素材 zip）
pnpm build:mac                # macOS DMG（不含素材 zip）
```

## 初始素材外置

角色立绘等大体积 PNG **不打进安装包**。安装包仅含登录页与壳层必要素材（背景、品牌 logo 等），以及**内置素材清单**（`src/shared/arena/bundled-asset-pack-manifest.json`，随应用版本编译进主进程）。

素材 zip 包含 `character-packs/` 与 `game-mode-packs/`，由用户主动载入：

1. **首次初始化向导** — 按内置清单从 GitHub Release / CDN 下载并解压；失败时可跳过（使用内置 default 占位）或导入本地 zip
2. **设置中心 → 数据管理** — 重新下载，或选择本地 zip 载入

缺少某角色素材文件时，运行时与初始化均会回退到 `character-packs/default/` 占位图。

运行时目录（`userData/{appId}/`）：

- zip 缓存：`arena-asset-pack/{fileName}`
- 解压素材：`arena-assets/`

**发布步骤：**

1. 设置 OSS 地址并执行 `pnpm pack:assets`（可用 `ARENA_ASSETS_BASE_URL` 覆盖 `downloadUrl`）
2. 将 `.tmp/asset-pack/` 中的 **zip 上传到 OSS**（无需单独上传 manifest）
3. 提交 `src/shared/arena/bundled-asset-pack-manifest.json`（含 sha256 / downloadUrl）
4. 执行 `pnpm build:win` / `pnpm build:mac` 打安装包（**不含**素材 zip，**含**内置 manifest）

**本地开发：**

```bash
pnpm pack:assets
pnpm install:asset-pack-local   # 可选：预置 zip 到 userData 缓存
pnpm dev
```

或在应用内走 **初始化向导** / **设置中心** 下载。开发素材工作区见下文 `.dev-assets/`。

## 开发素材工作区（`.dev-assets/`）

开发环境专用目录，**已 gitignore**。首次可通过：

```bash
pnpm init:dev-assets
```

或在应用底部 **素材管理** 中自动初始化（若 userData 已有素材会复制到 `.dev-assets/`）。

目录内各文件夹均含 `README.md` 说明子目录结构。素材管理页**仅管理** `character-packs/` 与 `game-mode-packs/`。壳层静态图请直接维护 `src/renderer/src/assets/home/`、`characters/`。

- 平铺浏览 / 删除文件
- **同步运行时** — 复制素材包到 userData 安装目录
- **打包导出** — 打包为 initial 素材 zip，并更新 `bundled-asset-pack-manifest.json`

`pnpm pack:assets` 会优先从 `.dev-assets/` 打包角色视觉素材。

## 平台说明

- **Windows**：在 Windows 上执行 `pnpm build:win`，生成 `dist/*-setup.exe`
- **macOS**：在 macOS 上执行 `pnpm build:mac`，生成 `dist/*.dmg`
- **交叉编译**：electron-builder 对 macOS 产物通常要求在 macOS 上构建；Windows 包在 Windows 上构建最稳妥

配置见根目录 `electron-builder.yml`。

## 图标

| 文件 | 用途 |
|------|------|
| `build/icon.ico` | Windows |
| `build/icon.icns` | macOS |
| `build/icon.png` | 通用源图（可选） |

脚手架自带占位图标，发布前请替换为产品图标。

## 签名（可选）

- Windows：配置 `CSC_LINK` / `CSC_KEY_PASSWORD` 后去掉 `electron-builder.yml` 中 `win.sign: null`
- macOS：配置 Apple 开发者证书与 `notarize: true`

内测默认不签名，避免本机缺少证书导致构建失败。

## 主进程依赖

`electron-store` 会在构建时打入 `out/main/index.js`（见 `electron.vite.config.ts` 中 `exclude: ['electron-store']`）。这样可避免 pnpm 下传递依赖 `conf` 未进 asar 导致安装后 `Cannot find module 'conf'`。

`auth-session.ts` 使用 `app.getName()` + `app.getPath('userData')` 初始化 store，避免打包后 `Project name could not be inferred`。
