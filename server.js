const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");

// 根据文件后缀返回正确的文件类型
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function send(res, code, body, type) {
  res.writeHead(code, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"
  });
  res.end(body);
}

function readFileSafe(p, res, type) {
  fs.readFile(p, (err, data) => {
    if (err) return send(res, 404, "Not Found", "text/plain; charset=utf-8");
    send(res, 200, data, type);
  });
}

const server = http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return send(res, 405, "Method Not Allowed", "text/plain; charset=utf-8");
  }

  let url;
  try {
    url = decodeURIComponent(req.url.split("?")[0]);
  } catch {
    return send(res, 400, "Bad Request", "text/plain; charset=utf-8");
  }

  if (url === "/healthz") {
    return send(
      res,
      200,
      JSON.stringify({ ok: true, service: "ai-daily-lite" }),
      "application/json; charset=utf-8"
    );
  }

  if (url === "/") url = "/index.html";

  // data.json 和 theme.json 放在项目根目录，方便用户直接让 AI 修改
  if (url === "/data.json" || url === "/theme.json") {
    return readFileSafe(path.join(ROOT, url), res, TYPES[".json"]);
  }

  const filePath = path.join(PUBLIC, path.normalize(url));
  if (!filePath.startsWith(PUBLIC)) {
    return send(res, 403, "Forbidden", "text/plain; charset=utf-8");
  }
  const ext = path.extname(filePath).toLowerCase();
  readFileSafe(filePath, res, TYPES[ext] || "application/octet-stream");
});

const envPort = Number.parseInt(process.env.PORT || "", 10);

if (Number.isInteger(envPort) && envPort > 0 && envPort < 65536) {
  const host = process.env.HOST || "0.0.0.0";
  server.listen(envPort, host, () => {
    console.log(`AI 日报正在 http://${host}:${envPort} 运行`);
  });
} else {
  function listen(port) {
    const onListening = () => {
      server.off("error", onError);
      console.log(`AI 日报已启动：http://127.0.0.1:${port}`);
    };
    const onError = error => {
      server.off("listening", onListening);
      if (error.code !== "EADDRINUSE") throw error;
      console.log(`端口 ${port} 被占用，尝试 ${port + 1} ...`);
      listen(port + 1);
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, "127.0.0.1");
  }
  listen(3000);
}
