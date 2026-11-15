import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

run("npm", ["run", "check"]);
run("npm", ["run", "check:sources"]);
run("npm", ["run", "export:obsidian"]);

const data = JSON.parse(await readFile(new URL("../data.json", import.meta.url), "utf8"));
run("git", ["add", "data.json"]);

const diff = spawnSync("git", ["diff", "--cached", "--quiet", "--", "data.json"]);
if (diff.status === 0) {
  console.log("日报内容没有变化，无需发布。");
  process.exit(0);
}
if (diff.status !== 1) process.exit(diff.status || 1);

run("git", ["commit", "-m", `Update AI daily for ${data.date}`]);
run("git", ["push", "origin", "main"]);
console.log("日报已推送，GitHub Pages 将自动发布新版本。");
