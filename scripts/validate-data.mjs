import { readFile } from "node:fs/promises";

const data = JSON.parse(await readFile(new URL("../data.json", import.meta.url), "utf8"));
const errors = [];
const warnings = [];

if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date || "")) {
  errors.push("data.date 必须是 YYYY-MM-DD");
}

if (!Array.isArray(data.items) || data.items.length < 6 || data.items.length > 12) {
  errors.push("data.items 必须包含 6–12 条内容");
}

const ids = new Set();
let leadCount = 0;
for (const [index, item] of (data.items || []).entries()) {
  const label = `第 ${index + 1} 条`;
  if (!Number.isInteger(item.id)) errors.push(`${label} id 必须是整数`);
  if (ids.has(item.id)) errors.push(`${label} id 重复`);
  ids.add(item.id);
  for (const field of ["title", "brief", "category", "priority", "sourceName", "sourceUrl"]) {
    if (typeof item[field] !== "string" || !item[field].trim()) {
      errors.push(`${label} 缺少 ${field}`);
    }
  }
  if (!["lead", "important", "normal"].includes(item.priority)) {
    errors.push(`${label} priority 只能是 lead、important 或 normal`);
  }
  if (item.priority === "lead") leadCount += 1;
  try {
    const url = new URL(item.sourceUrl);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    if (url.protocol !== "https:") warnings.push(`${label} 来源不是 HTTPS`);
  } catch {
    errors.push(`${label} sourceUrl 无效`);
  }
}

if (leadCount !== 1) errors.push("必须且只能有 1 条 lead 头条");

for (const warning of warnings) console.warn(`警告：${warning}`);
if (errors.length) {
  for (const error of errors) console.error(`错误：${error}`);
  process.exit(1);
}

console.log(`数据校验通过：${data.date}，${data.items.length} 条内容，${warnings.length} 个警告。`);
