# renderer 静态资源

随安装包打包（Vite 内嵌），**不在** initial 素材 zip 中。

```
home/                 # 壳层 UI（背景、品牌、吉祥物、法官头像等）
characters/avatars/   # 登录页装饰头像（doubao / gpt / claude）
```

角色立绘与玩法封面等大体积素材请维护 `.dev-assets/`（开发）或 userData `arena-assets/`（运行时）。

角色包目录结构元数据（manifest）在 `src/renderer/src/data/pack-manifests/`。
