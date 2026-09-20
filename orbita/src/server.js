import http from "node:http";
import {
  status,
  addInvestor,
  addTask,
  requestAction,
  listApprovals,
  listInvestors,
  listTasks
} from "./engine.js";

function json(res, code, body) {
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(body, null, 2));
}

async function readBody(req) {
  let body = "";
  for await (const chunk of req) body += chunk;
  if (!body) return {};
  return JSON.parse(body);
}

export function createServer(port = Number(process.env.PORT || 3010)) {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");

      if (req.method === "GET" && url.pathname === "/health") {
        return json(res, 200, { ok: true, module: "ORBITA" });
      }

      if (req.method === "GET" && url.pathname === "/api/orbita/status") {
        return json(res, 200, status());
      }

      if (req.method === "GET" && url.pathname === "/api/orbita/investors") {
        return json(res, 200, { investors: listInvestors() });
      }

      if (req.method === "GET" && url.pathname === "/api/orbita/tasks") {
        return json(res, 200, { tasks: listTasks() });
      }

      if (req.method === "GET" && url.pathname === "/api/orbita/approvals") {
        return json(res, 200, { approvals: listApprovals() });
      }

      if (req.method === "POST" && url.pathname === "/api/orbita/investors") {
        return json(res, 201, addInvestor(await readBody(req)));
      }

      if (req.method === "POST" && url.pathname === "/api/orbita/tasks") {
        return json(res, 201, addTask(await readBody(req)));
      }

      if (req.method === "POST" && url.pathname === "/api/orbita/action") {
        const body = await readBody(req);
        return json(res, 200, requestAction(body.action, body.details || {}));
      }

      return json(res, 404, { error: "Not found" });
    } catch (error) {
      return json(res, 400, { error: error.message });
    }
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`[ORBITA] API listening on port ${port}`);
  });

  return server;
}
