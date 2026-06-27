# Arena — 开发约定

本项目由 `create-mntools-app` 生成（Electron），**完整源码在仓库内**，可独立开发与打包。

## 结构

```
src/main/           主进程（窗口、IPC）
src/preload/        预加载桥接
src/renderer/src/   Vue 3 渲染层
src/shared/         跨进程类型
```

## 约定

- 导航唯一来源：`src/renderer/src/data/feature-registry.ts`
- 页面加载：`src/renderer/src/data/page-loaders.ts`
- 应用配置：`src/renderer/src/app.config.ts`（`update` 不覆盖）
- IPC 命名：`module:action`
- HTTP 必须经 `window.api.fetchUrl`（主进程代理）

## 同步脚手架更新

本项目已独立定制，不再依赖 `.mntools-scaffold.json`。如需对齐 mntools 脚手架能力，请手动 cherry-pick 相关模块。

## 添加页面

1. `feature-registry.ts` 注册 route
2. `page-loaders.ts` 添加 lazy import
3. 新建 `src/renderer/src/pages/YourPage.vue`
