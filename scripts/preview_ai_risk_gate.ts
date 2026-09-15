// Local preview of the same Web API middleware used on Vercel.
// Run the built app on 4176 first, then: node --import tsx scripts/preview_ai_risk_gate.ts
import { createServer } from "node:http";
import middleware from "../middleware";

process.loadEnvFile(".env.local");
const upstream = "http://127.0.0.1:4176";
const localOrigin = "http://127.0.0.1:4177";

const server = createServer((incoming, outgoing) => {
  void (async () => {
    const parts: Buffer[] = [];
    for await (const chunk of incoming) parts.push(Buffer.from(chunk as Uint8Array));
    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers)) {
      if (value) headers.set(name, Array.isArray(value) ? value.join(",") : value);
    }
    const method = incoming.method ?? "GET";
    const request = new Request(new URL(incoming.url ?? "/", localOrigin), { method, headers, ...(method !== "GET" && method !== "HEAD" ? { body: Buffer.concat(parts) } : {}) });
    const gate = await middleware(request);
    const response = gate.headers.has("x-middleware-next")
      ? await fetch(new URL(incoming.url ?? "/", upstream), { method, headers, redirect: "manual" })
      : gate;
    outgoing.statusCode = response.status;
    for (const [name, value] of response.headers) {
      if (!["content-encoding", "content-length", "transfer-encoding", "x-middleware-next"].includes(name)) outgoing.setHeader(name, value);
    }
    if (response !== gate) for (const [name, value] of gate.headers) {
      if (name !== "x-middleware-next") outgoing.setHeader(name, value);
    }
    outgoing.end(method === "HEAD" ? undefined : Buffer.from(await response.arrayBuffer()));
  })().catch(() => {
    outgoing.statusCode = 500;
    outgoing.end("Local preview error");
  });
});
server.listen(4177, "127.0.0.1", () => console.log(`Password-gated preview: ${localOrigin}/ai-risk`));
