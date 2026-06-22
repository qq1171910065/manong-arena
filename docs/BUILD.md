# 构建与发布

## 命令

```bash
pnpm build              # electron-vite → out/
pnpm build:unpack       # 当前平台未打包目录 → dist/
pnpm build:win          # Windows NSIS 安装包（仅 Windows）
pnpm build:mac          # macOS DMG（仅 macOS）
```

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
