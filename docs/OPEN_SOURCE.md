# Manong Arena 开源说明

本仓库为 **Manong Arena 桌面客户端**（Electron），采用 [MIT](../LICENSE) 协议开源。

Platform 后端（账户、网关、计费、发版接口等）**不在本仓库**，需自行部署或使用你控制的 Platform 实例。

## 仓库地址

| 平台 | 地址 |
|------|------|
| GitHub（开源） | https://github.com/qq1171910065/manong-arena |
| Gitee（同步） | https://gitee.com/czmanong/arena |

## 首次配置双端推送

在仓库根目录执行一次：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-remotes.ps1
```

之后分别推送，避免 GitHub 凭证未配置时卡住 Gitee：

```bash
git push origin master      # Gitee
pnpm publish:github         # GitHub（需 Classic PAT，见下）
```

或使用 `pnpm push -- master` 依次推 Gitee 与 GitHub。

## 首次发布到 GitHub（一键）

1. 生成 **Classic** Personal Access Token（**不是** Fine-grained）  
   https://github.com/settings/tokens/new → 勾选 **`repo`**

2. 在本机设置环境变量（**不要提交到 git**）：

   ```powershell
   $env:GITHUB_TOKEN = 'ghp_xxxxxxxx'
   ```

3. 执行：

   ```powershell
   pnpm publish:github
   ```

脚本会自动：创建 `qq1171910065/manong-arena` 仓库 → 推送 `master` → 推送 tag `v{version}` → 触发 Release CI（仅构建 Win/Mac 安装包）。

## 发布新版本

### 1. 代码与安装包（CI）

1. 更新 `package.json` 的 `version`，提交并推送
2. 打 tag 并推送，触发 GitHub Actions：

   ```powershell
   git tag v0.1.1
   pnpm publish:github
   ```

3. 在 **Actions** 等待 Win/Mac 构建完成；Release 页面会出现：

   ```
   v0.1.1/
   ├── windows/manong-arena-{version}-setup.exe
   └── macos/manong-arena-{version}.dmg
   ```

### 2. 完整素材包（本地，不进 CI）

`.dev-assets/` 被 gitignore，完整立绘素材包**只能在本地**从开发素材目录打包：

```powershell
# 确保已有 .dev-assets/（pnpm init:dev-assets 或应用内素材管理）
$env:GITHUB_TOKEN = 'ghp_xxxxxxxx'
pnpm upload:release-assets
```

脚本会：`pnpm pack:assets`（读取 `.dev-assets/`）→ 上传到 Release 的 `v{version}/assets/arena-initial-assets-{version}.zip`。

若 `pack:assets` 更新了 `src/shared/arena/bundled-asset-pack-manifest.json`（sha256 / downloadUrl），请一并提交。

> 安装包内置**默认素材**（`bundled-assets/` 纯色占位）。完整素材包走 Release 的 `assets/` 目录或应用内下载。未安装完整包或缺少某角色素材时，客户端会回退到「默认」占位图，不阻断初始化。

## Platform 地址配置

生产环境默认**不内置**私有 Platform 地址。用户可在应用 **设置 → 平台地址** 填写，或在构建时设置：

```bash
VITE_PLATFORM_API_URL=https://your-platform.example.com pnpm build
```

开发模式默认连接 `http://127.0.0.1:8010`。

## 素材包 CDN

完整素材包在本地打包（依赖 `.dev-assets/`，不进 git）：

```powershell
pnpm pack:assets                    # 输出到 .tmp/asset-pack/
pnpm upload:release-assets          # 打包并上传到 GitHub Release（需 GITHUB_TOKEN）
```

自定义 CDN 前缀：

```bash
ARENA_ASSETS_BASE_URL=https://your-cdn.example.com/arena pnpm pack:assets
```

提交更新后的 `src/shared/arena/bundled-asset-pack-manifest.json`（sha256 / downloadUrl）。
