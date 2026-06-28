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

脚本会自动：创建 `qq1171910065/manong-arena` 仓库 → 推送 `master` → 推送 tag `v0.1.0` → 触发 Release CI。

若未运行 setup 脚本，可用：

```bash
pnpm push -- master
pnpm push -- origin v0.1.0
```

## 发布新版本（含安装包）

1. 更新 `package.json` 的 `version`
2. 提交并推送代码：

   ```bash
   git add .
   git commit -m "chore: release v0.1.0"
   git push origin master
   ```

3. 打 tag 并推送（触发 GitHub Actions 构建 Release）：

   ```bash
   git tag v0.1.0
   pnpm publish:github
   ```

4. 在 GitHub → **Actions** 查看 `Release` 工作流；完成后在 **Releases** 页面下载（按版本号分目录）：

   ```
   v0.1.0/
   ├── windows/arena-{version}-setup.exe
   ├── macos/arena-{version}.dmg
   └── assets/arena-initial-assets-{version}.zip
   ```

> 安装包内置**默认素材**（纯色占位角色与玩法封面）。完整立绘素材包可在首次启动时在线下载，或从 Release 的 `assets/` 目录手动导入 zip。

## Platform 地址配置

生产环境默认**不内置**私有 Platform 地址。用户可在应用 **设置 → 平台地址** 填写，或在构建时设置：

```bash
VITE_PLATFORM_API_URL=https://your-platform.example.com pnpm build
```

开发模式默认连接 `http://127.0.0.1:8010`。

## 素材包 CDN

打包素材清单时需指定公开可访问的前缀：

```bash
ARENA_ASSETS_BASE_URL=https://your-cdn.example.com/arena pnpm pack:assets
```

提交更新后的 `src/shared/arena/bundled-asset-pack-manifest.json`，并将 zip 上传到对应 Release 的 `{version}/assets/` 目录（CI 会自动打包并上传）。
