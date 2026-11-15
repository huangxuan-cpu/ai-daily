# AI 日报 · DeepSeek Harness 版

这是从 WorkBuddy 迁移来的轻量 AI 日报项目。页面保留原来的报纸风格，DeepSeek Harness 负责在每天中午搜索、核验并更新选题数据，GitHub Pages 负责提供固定公网网址。

## 本地运行

```bash
npm start
```

默认地址是 `http://127.0.0.1:3000`。如端口被占用，会自动顺延。健康检查地址为 `/healthz`。

## 发布前检查

```bash
npm run check
npm run check:sources
```

第一项检查数据结构，第二项检查来源链接是否可访问。来源能打开不代表事实已经核验；每日任务仍须逐条阅读原文。

## 每日存档

日报更新完成后运行：

```bash
npm run export:obsidian
```

笔记写入 iCloud 里的 Obsidian 库 `AI日报`：

- `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/AI日报/YYYY-MM-DD.md`：一期一篇，按头条 / 重点 / 常规分组
- `…/AI日报/索引.md`：全部期数的入口，自动重建
- `archive/YYYY-MM-DD.json`：当期 `data.json` 的原始快照，用来保住被覆盖前的历史

库根目录直接按日期放笔记，在 Obsidian 里「打开文件夹作为库」指向 `AI日报` 即可。同一天按最新内容重写时加 `--force`，文末「我的笔记」一节会保留。需要换库位置时用 `AIDAILY_VAULT=/path/to/vault npm run export:obsidian`。

## 自动发布

```bash
npm run publish
```

该命令会依次检查数据、检查来源、生成 Obsidian 存档，然后只提交当天的 `data.json` 并推送到 `main`。GitHub Actions 会把 `public/`、`data.json` 和 `theme.json` 组合成静态网站并发布到 GitHub Pages。iCloud 里的 `AI日报` 库与 `archive/` 只保留在本机，不会公开上传。

## 维护方式

- 日报内容：`data.json`
- 颜色与名称：`theme.json`
- 每日更新规则：`AGENTS.md`
- Harness 自动化配置说明：`HARNESS_AUTOMATION.md`

WorkBuddy 原在线页面可以在新网址稳定后保留为备用入口。
