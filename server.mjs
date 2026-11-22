import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { classify } from "./mock-ai.mjs";

const html = await readFile(new URL("./index.html", import.meta.url));

const AI_TIMEOUT = 300;
const ALLOWED_TOPICS = new Set(["delivery", "pricing", "other"]);

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function manualReview(response) {
  return json(response, 200, {
    status: "manual_review",
    topic: null,
    draft: null,
  });
}

async function readBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function handleTriage(request, response) {
  let body;
  let timeoutId;

  try {
    body = await readBody(request);
  } catch {
    return json(response, 400, { status: "invalid_input" });
  }

  if (
      !body ||
      typeof body !== "object" ||
      typeof body.text !== "string" ||
      !body.text.trim()
  ) {
    return json(response, 400, { status: "invalid_input" });
  }

  try {
    const result = await Promise.race([
      classify(body.text).then((raw) => JSON.parse(raw)),
      new Promise((_, reject) => {
          timeoutId = setTimeout(
              () => reject(new Error("AI timeout")),
              AI_TIMEOUT
          );
        }
      ),
    ]);

    if (
        !result ||
        typeof result !== "object" ||
        !ALLOWED_TOPICS.has(result.topic) ||
        typeof result.draft !== "string" ||
        !result.draft.trim()
    ) {
      return manualReview(response);
    }

    return json(response, 200, {
      status: "ready",
      topic: result.topic,
      draft: result.draft,
    });
  } catch {
    return manualReview(response);
  } finally {
    clearTimeout(timeoutId);
  }
}

createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(html);
    return;
  }
  
  if (request.method !== "POST" || request.url !== "/api/triage") {
    return json(response, 404, { status: "not_found" });
  }
  
  try {
    await handleTriage(request, response);
  } catch {
    json(response, 500, { status: "server_error" });
  }
}).listen(Number(process.env.PORT || 3000), "127.0.0.1");
