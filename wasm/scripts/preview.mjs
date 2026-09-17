import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

const root = resolve("wasm/dist");
const port = Number(process.env.EPI_INFO_PREVIEW_PORT || 4173);
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".geojson", "application/geo+json"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".tif", "image/tiff"],
  [".tiff", "image/tiff"],
  [".wasm", "application/wasm"],
]);

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname);
    const relativePath = pathname === "/" ? "index.html" : normalize(pathname).replace(/^[/\\]+/, "");
    const file = resolve(join(root, relativePath));
    if (file !== root && !file.startsWith(`${root}${sep}`)) throw new Error("Invalid path");
    const fileStat = await stat(file);
    if (!fileStat.isFile()) throw new Error("Not found");
    const commonHeaders = {
      "content-type": contentTypes.get(extname(file)) || "application/octet-stream",
      "cache-control": "no-store",
      "accept-ranges": "bytes",
    };
    if (request.method === "HEAD") {
      response.writeHead(200, { ...commonHeaders, "content-length": fileStat.size });
      response.end();
      return;
    }
    const range = request.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    if (range) {
      const start = Number(range[1]);
      const requestedEnd = range[2] ? Number(range[2]) : fileStat.size - 1;
      const end = Math.min(requestedEnd, fileStat.size - 1);
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= fileStat.size) {
        response.writeHead(416, { ...commonHeaders, "content-range": `bytes */${fileStat.size}` });
        response.end();
        return;
      }
      response.writeHead(206, { ...commonHeaders, "content-range": `bytes ${start}-${end}/${fileStat.size}`, "content-length": end - start + 1 });
      createReadStream(file, { start, end }).pipe(response);
      return;
    }
    response.writeHead(200, { ...commonHeaders, "content-length": fileStat.size });
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  const address = server.address();
  const activePort = typeof address === "object" && address ? address.port : port;
  process.stdout.write(`Epi Info AI preview: http://127.0.0.1:${activePort}/\n`);
});
