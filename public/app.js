// AI 日报前端：读取 data.json（内容）和 theme.json（外观）并渲染页面
async function loadJSON(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("无法读取 " + url);
  return res.json();
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]
  ));
}

function renderItem(it) {
  const src = it.sourceUrl
    ? `<a href="${esc(it.sourceUrl)}" target="_blank" rel="noopener noreferrer">来源：${esc(it.sourceName || "原文链接")}</a>`
    : `来源：${esc(it.sourceName || "本站")}`;
  const summary = (it.priority === "lead" && it.summary)
    ? `<p class="summary">${esc(it.summary)}</p>` : "";
  return `
    <article class="item ${esc(it.priority || "normal")}">
      <span class="category">${esc(it.category || "综合")}</span>
      <h2>${esc(it.title)}</h2>
      ${it.brief ? `<p class="brief">${esc(it.brief)}</p>` : ""}
      ${summary}
      <p class="source">${src}</p>
    </article>`;
}

function applyTheme(t) {
  const r = document.documentElement.style;
  if (t.bgColor) r.setProperty("--bg", t.bgColor);
  if (t.textColor) r.setProperty("--text", t.textColor);
  if (t.accentColor) r.setProperty("--accent", t.accentColor);
  if (t.titleFont === "serif") {
    r.setProperty("--title-font", 'Georgia, "Songti SC", "Noto Serif SC", "SimSun", serif');
  } else if (t.titleFont === "sans") {
    r.setProperty("--title-font", '-apple-system, "PingFang SC", "Helvetica Neue", sans-serif');
  }
  // 紧凑程度：tight（紧凑）/ normal（标准）/ loose（宽松）
  const c = t.compact || "normal";
  const gaps = { tight: ["1rem", "1.2rem", "0.9rem"], normal: ["1.75rem", "2.2rem", "1.4rem"], loose: ["2.6rem", "3.4rem", "2.2rem"] };
  const [gap, px, py] = gaps[c] || gaps.normal;
  r.setProperty("--gap", gap);
  r.setProperty("--pad-x", px);
  r.setProperty("--pad-y", py);
}

function editionLabel(dateText) {
  const parts = String(dateText || "").split("-").map(Number);
  const valid = parts.length === 3 && parts.every(Number.isInteger);
  const d = valid
    ? new Date(parts[0], parts[1] - 1, parts[2], 12)
    : new Date();
  const week = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 · 星期${week}`;
}

async function main() {
  const [data, theme] = await Promise.all([loadJSON("./data.json"), loadJSON("./theme.json")]);
  applyTheme(theme);
  document.getElementById("paper-name").textContent = theme.name || "AI 日报";
  document.title = theme.name || "AI 日报";
  document.getElementById("edition-date").textContent = editionLabel(data.date);
  const note = document.getElementById("edition-note");
  if (data.note) {
    note.textContent = data.note;
    note.hidden = false;
  }
  const news = document.getElementById("news");
  // 保持 data.json 中的顺序，不重排
  news.innerHTML = (data.items || []).map(renderItem).join("");
}

main().catch(e => {
  document.getElementById("news").innerHTML =
    `<article class="item lead"><h2>页面加载失败</h2><p class="brief">${e.message}</p></article>`;
});
