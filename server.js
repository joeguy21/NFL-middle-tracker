const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = process.env.PORT || 10000;
const API_KEY = process.env.FANLINE_API_KEY;
const API_BASE = "https://api.fanlinewire.com";
const ROOT = __dirname;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");

  if (url.pathname === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, keyConfigured: Boolean(API_KEY) }));
  }

  if (url.pathname === "/api/odds") {
    if (!API_KEY) {
      res.writeHead(503, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: false, error: "FANLINE_API_KEY is not configured in Render." }));
    }
    try {
      const upstream = await fetch(`${API_BASE}/v1/board.json`, {
        headers: { "x-api-key": API_KEY, "Accept": "application/json" },
        signal: AbortSignal.timeout(12000)
      });
      const body = await upstream.text();
      res.writeHead(upstream.status, {
        "Content-Type": upstream.headers.get("content-type") || "application/json",
        "Cache-Control": "no-store"
      });
      return res.end(body);
    } catch (err) {
      res.writeHead(502, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: false, error: "FanLine odds service could not be reached." }));
    }
  }

  const requested = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
  const filePath = path.resolve(ROOT, requested);
  if (!filePath.startsWith(ROOT + path.sep) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404); return res.end("Not found");
  }
  const ext = path.extname(filePath);
  const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json" };
  res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, "0.0.0.0", () => console.log(`NFL tracker listening on ${PORT}`));
