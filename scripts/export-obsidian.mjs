#!/usr/bin/env node
/**
 * 把 data.json 导出成 Obsidian 笔记，写入 iCloud 里的 AI 日报库。
 *
 *   node scripts/export-obsidian.mjs           # 新建当天笔记；已存在则跳过
 *   node scripts/export-obsidian.mjs --force   # 重写当天笔记，保留「我的笔记」一节
 *
 * 产物：
 *   ~/Library/Mobile Documents/iCloud~md~obsidian/Documents/AI日报/YYYY-MM-DD.md
 *   ~/Library/Mobile Documents/iCloud~md~obsidian/Documents/AI日报/索引.md
 *   archive/YYYY-MM-DD.json                  data.json 的每日快照，保住历史
 *
 * 换库路径：AIDAILY_VAULT=/path/to/vault npm run export:obsidian
 */
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOME = homedir();
const DATA_FILE = path.join(ROOT, "data.json");
const ARCHIVE_DIR = path.join(ROOT, "archive");
const VAULT_DIR = process.env.AIDAILY_VAULT
  ? path.resolve(process.env.AIDAILY_VAULT.replace(/^~(?=$|\/)/, HOME))
  : path.join(
      HOME,
      "Library/Mobile Documents/iCloud~md~obsidian/Documents/AI日报"
    );

const FORCE = process.argv.includes("--force");
const MARKER = "<!-- generated-by: scripts/export-obsidian.mjs -->";
const PRIORITY_LABEL = { lead: "头条", important: "重点", normal: "常规" };
const PRIORITY_ORDER = ["lead", "important", "normal"];
const NOTES_HEADING = "## 我的笔记";
const DEFAULT_NOTES = [
  NOTES_HEADING,
  "",
  "<!-- 这一节在重新生成时会被保留，可以随手记：为什么这个题能爆、评论区在吵什么、还能延展哪些角度。 -->",
  "",
].join("\n");
const INDEX_NAME = "索引.md";
const GUIDE_NAME = "使用说明.md";

const GUIDE = [
  "# AI 日报 · 使用说明",
  "",
  "- 每天更新完日报，在项目里运行 `npm run export:obsidian`，当天的笔记就会出现在本库根目录。",
  "- 笔记按日期命名（如 `2026-11-14.md`），分类以标签形式写在 frontmatter 里（`选题/黑科技` 等），可直接按标签检索。",
  "- 每条选题都带可点击的原始来源，回看时不必再去翻聊天记录。",
  "- 笔记末尾的「我的笔记」一节在重新生成时会保留，其余内容会按最新 `data.json` 重写。",
  "- `索引.md` 是自动重建的期数总览。",
  "",
].join("\n");

const displayPath = target =>
  target.startsWith(HOME) ? `~${target.slice(HOME.length)}` : target;

function die(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

const oneLine = (value = "") => String(value).replace(/\s*\n\s*/g, " ").trim();

/** YAML 双引号字符串，顺便压平换行 */
const yamlString = value =>
  `"${oneLine(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

/** 防止正文里的 | 破坏表格与列表 */
const mdText = value => oneLine(value).replace(/\|/g, "\\|");

const linkText = value => oneLine(value).replace(/([[\]])/g, "\\$1");

function loadData(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    die(`data.json 不是合法 JSON：${error.message}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date ?? "")) {
    die("data.json 的 date 必须是 YYYY-MM-DD");
  }
  if (!Array.isArray(data.items) || data.items.length === 0) {
    die("data.json 没有可导出的 items");
  }
  for (const item of data.items) {
    if (!item?.title) die(`第 ${item?.id ?? "?"} 条缺少 title`);
    if (!PRIORITY_ORDER.includes(item.priority)) {
      die(`第 ${item.id} 条 priority 无效：${item.priority}`);
    }
  }
  return data;
}

function countByPriority(items) {
  return PRIORITY_ORDER.map(priority => ({
    priority,
    label: PRIORITY_LABEL[priority],
    total: items.filter(item => item.priority === priority).length,
  })).filter(group => group.total > 0);
}

function renderItem(item) {
  const lines = [
    `### ${item.id}. ${oneLine(item.title)}`,
    "",
    `- **分类**：${oneLine(item.category)} ｜ **优先级**：${PRIORITY_LABEL[item.priority]}`,
    `- **一句话**：${mdText(item.brief)}`,
  ];
  if (oneLine(item.summary)) {
    lines.push(`- **选题角度**：${mdText(item.summary)}`);
  }
  lines.push(`- **来源**：[${linkText(item.sourceName)}](<${oneLine(item.sourceUrl)}>)`);
  return lines.join("\n");
}

function renderNote(data, notes = DEFAULT_NOTES) {
  const items = [...data.items].sort((a, b) => a.id - b.id);
  const counts = countByPriority(items);
  const tags = [...new Set(["AI日报", ...items.map(item => `选题/${oneLine(item.category)}`)])];
  const lead = items.find(item => item.priority === "lead");

  const frontmatter = [
    "---",
    `date: ${yamlString(data.date)}`,
    "type: ai-daily",
    `items: ${items.length}`,
    lead ? `lead: ${yamlString(lead.title)}` : null,
    `important: ${counts.find(group => group.priority === "important")?.total ?? 0}`,
    "tags:",
    ...tags.map(tag => `  - ${tag}`),
    "---",
  ].filter(Boolean);

  const overview = counts.map(group => `${group.label} ${group.total}`).join(" · ");
  const sections = [`# AI 日报 · ${data.date}`, "", `> 本期 ${items.length} 条：${overview}。`];

  for (const { priority, label } of counts) {
    const group = items.filter(item => item.priority === priority);
    sections.push("", `## ${label}`, "", group.map(renderItem).join("\n\n"));
  }

  sections.push("", "---", "", notes.trimEnd(), "");
  return `${MARKER}\n${frontmatter.join("\n")}\n\n${sections.join("\n")}`;
}

/** 从旧笔记里取出「我的笔记」及之后的内容 */
function extractNotes(existing) {
  const at = existing.indexOf(NOTES_HEADING);
  if (at === -1) return null;
  return existing.slice(at);
}

function readFrontmatter(text) {
  const meta = {};
  // 笔记开头可能有一行生成标记，frontmatter 不一定在第 1 行
  const start = text.indexOf("---\n");
  if (start === -1) return meta;
  const rest = text.slice(start + 4);
  const end = rest.indexOf("\n---");
  if (end === -1) return meta;
  for (const line of rest.slice(0, end).split("\n")) {
    const pair = /^(\w+):\s*(.*)$/.exec(line);
    if (!pair) continue;
    meta[pair[1]] = pair[2].replace(/^"(.*)"$/, "$1");
  }
  return meta;
}

async function collectNotes(dir) {
  const found = [];
  async function walk(current) {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (/^\d{4}-\d{2}-\d{2}\.md$/.test(entry.name)) {
        found.push(full);
      }
    }
  }
  await walk(dir);
  return found;
}

async function writeIfMissing(target, content) {
  try {
    await readFile(target, "utf8");
    return false;
  } catch {
    await writeFile(target, content, "utf8");
    return true;
  }
}

/** 让文件夹能被 Obsidian 直接识别为库，并放一份最简单的使用说明 */
async function ensureVault() {
  await mkdir(VAULT_DIR, { recursive: true });
  await mkdir(path.join(VAULT_DIR, ".obsidian"), { recursive: true });
  await writeIfMissing(path.join(VAULT_DIR, ".obsidian", "app.json"), "{}\n");
  await writeIfMissing(path.join(VAULT_DIR, GUIDE_NAME), GUIDE);
}

async function writeDailyNote(data) {
  const notePath = path.join(VAULT_DIR, `${data.date}.md`);

  let existing = null;
  try {
    existing = await readFile(notePath, "utf8");
  } catch {
    // 文件不存在，正常路径
  }

  if (existing === null) {
    await writeFile(notePath, renderNote(data), "utf8");
    return { status: "created", notePath };
  }
  if (!existing.includes(MARKER)) {
    console.warn(`⚠ ${displayPath(notePath)} 已存在且不是自动生成的笔记，已跳过以免覆盖你的内容`);
    return { status: "skipped", notePath };
  }
  if (!FORCE) {
    return { status: "exists", notePath };
  }

  const notes = extractNotes(existing) ?? DEFAULT_NOTES;
  await writeFile(notePath, renderNote(data, notes), "utf8");
  return { status: "rewritten", notePath };
}

async function writeArchive(raw, data) {
  await mkdir(ARCHIVE_DIR, { recursive: true });
  const archivePath = path.join(ARCHIVE_DIR, `${data.date}.json`);
  let existed = true;
  try {
    await readFile(archivePath, "utf8");
  } catch {
    existed = false;
  }
  const snapshot = `${JSON.stringify({ ...data, archivedAt: new Date().toISOString() }, null, 2)}\n`;
  await writeFile(archivePath, snapshot, "utf8");
  return { status: existed ? "updated" : "created", archivePath };
}

function todayInShanghai() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());
}

async function writeIndex() {
  const files = await collectNotes(VAULT_DIR);
  const entries = [];
  for (const file of files) {
    const text = await readFile(file, "utf8");
    const meta = readFrontmatter(text);
    const date = meta.date || path.basename(file, ".md");
    entries.push({
      date,
      items: Number.parseInt(meta.items ?? "0", 10) || 0,
      lead: meta.lead ?? "",
      link: `[[${date}]]`,
    });
  }

  entries.sort((a, b) => b.date.localeCompare(a.date));
  const total = entries.reduce((sum, entry) => sum + entry.items, 0);
  const months = new Map();
  for (const entry of entries) {
    const month = entry.date.slice(0, 7);
    if (!months.has(month)) months.set(month, []);
    months.get(month).push(entry);
  }

  const lines = [
    "---",
    "type: ai-daily-index",
    `updated: ${todayInShanghai()}`,
    "---",
    "# AI 日报索引",
    "",
    `共 ${entries.length} 期、${total} 条选题。本页由脚本自动重建，请勿手改。`,
  ];

  for (const [month, monthEntries] of months) {
    const [year, monthNumber] = month.split("-");
    lines.push("", `## ${year} 年 ${Number(monthNumber)} 月`, "");
    for (const entry of monthEntries) {
      const lead = entry.lead ? ` · ${entry.lead.replace(/\|/g, "\\|")}` : "";
      lines.push(`- ${entry.link} · ${entry.items} 条${lead}`);
    }
  }

  if (entries.length === 0) {
    lines.push("", "还没有归档的日报。运行 `npm run export:obsidian` 生成。");
  }

  const indexPath = path.join(VAULT_DIR, INDEX_NAME);
  await writeFile(indexPath, `${lines.join("\n")}\n`, "utf8");
  return { indexPath, count: entries.length, total };
}

const raw = await readFile(DATA_FILE, "utf8").catch(error => die(`无法读取 data.json：${error.message}`));
const data = loadData(raw);

await ensureVault();
const note = await writeDailyNote(data);
const archive = await writeArchive(raw, data);
const index = await writeIndex();

const noteLabel = {
  created: "已新建",
  rewritten: "已重写（「我的笔记」已保留）",
  exists: "已存在，跳过",
  skipped: "已跳过（非自动生成文件）",
}[note.status];

console.log(`✓ 库：${displayPath(VAULT_DIR)}`);
console.log(`✓ 笔记：${path.basename(note.notePath)}（${noteLabel}）`);
console.log(`✓ 快照：${path.relative(ROOT, archive.archivePath)}（${archive.status === "created" ? "新建" : "更新"}）`);
console.log(`✓ 索引：${INDEX_NAME}（${index.count} 期 / ${index.total} 条）`);
if (note.status === "exists") {
  console.log("  提示：同一天需要刷新内容时加 --force，文末「我的笔记」不会被覆盖。");
}
