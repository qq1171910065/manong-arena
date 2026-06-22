# Arena

Arena — Electron 桌面工具

由 **create-mntools-app** 生成的独立 Electron 项目。

## 开发

```bash
pnpm install
pnpm dev
```

需 Platform 后端时：`cd platform/server && npm run dev`

本地数据库使用 Node 内置 `node:sqlite`（Electron 39+），数据在 `userData/db/`。

## 构建安装包

先编译前端与主进程，再按平台打包（需在本机或对应 OS 的 CI 上执行）：

| 命令 | 说明 | 运行环境 |
|------|------|----------|
| `pnpm build` | 仅编译到 `out/` | 任意 |
| `pnpm build:unpack` | 未打包目录（调试用） | 当前系统 |
| `pnpm build:win` | Windows NSIS 安装包 | **Windows** |
| `pnpm build:mac` | macOS DMG | **macOS** |

产物在 `dist/`。Windows 为 `*-setup.exe`，macOS 为 `*.dmg`。

图标：替换 `build/icon.ico`（Windows）与 `build/icon.icns`（macOS），可选 `build/icon.png`。

未签名 Windows 包已配置 `sign: null`（开发/内测）。正式发布需配置代码签名与 Apple 公证。

## 文档

- [AGENTS.md](./AGENTS.md)
- [docs/THEME.md](./docs/THEME.md)
- [docs/BUILD.md](./docs/BUILD.md)
