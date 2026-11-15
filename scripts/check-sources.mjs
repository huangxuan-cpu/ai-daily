import { readFile } from "node:fs/promises";

const data = JSON.parse(await readFile(new URL("../data.json", import.meta.url), "utf8"));
let failures = 0;

for (const item of data.items || []) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(item.sourceUrl, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "Mozilla/5.0 AI-Daily-Source-Check/1.0" }
    });
    const blocked = [401, 403, 405, 429].includes(response.status);
    const ok = response.ok || blocked;
    console.log(`${ok ? "OK" : "FAIL"}\t${response.status}\t${item.id}\t${item.sourceName}`);
    if (!ok) failures += 1;
  } catch (error) {
    console.log(`FAIL\t${error.name}\t${item.id}\t${item.sourceName}`);
    failures += 1;
  } finally {
    clearTimeout(timer);
  }
}

if (failures) {
  console.error(`${failures} 个来源无法访问，请替换后再发布。`);
  process.exit(1);
}

console.log("来源连通性检查通过。注意：连通不等于事实已核验，仍需逐条阅读原文。\n");
