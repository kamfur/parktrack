// Local recorder for the PoC: serves record.html and saves uploaded WAVs to ./recordings.
// Usage: node scripts/soniox-poc/record-server.mjs  → open http://localhost:5178
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const recDir = path.join(here, "recordings");
const PORT = 5178;
await mkdir(recDir, { recursive: true });

const scenarios = JSON.parse(await readFile(path.join(here, "scenarios.json"), "utf8"));
const ids = new Set(scenarios.map((s) => s.id));

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(await readFile(path.join(here, "record.html")));
      return;
    }
    if (req.method === "GET" && url.pathname === "/scenarios.json") {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(scenarios));
      return;
    }
    if (req.method === "POST" && url.pathname === "/upload") {
      const id = url.searchParams.get("id");
      if (!ids.has(id)) {
        res.writeHead(400).end("Unknown scenario id");
        return;
      }
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const file = path.join(recDir, `${id}.wav`);
      await writeFile(file, Buffer.concat(chunks));
      console.log(`saved ${path.relative(process.cwd(), file)}`);
      res.writeHead(204).end();
      return;
    }
    res.writeHead(404).end();
  } catch (err) {
    res.writeHead(500).end(String(err));
  }
});

server.listen(PORT, "127.0.0.1", () => console.log(`Recorder: http://localhost:${PORT}`));
