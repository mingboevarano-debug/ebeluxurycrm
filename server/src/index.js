import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import http from "node:http";
import { z } from "zod";
import https from "https";
import { connectMongo, insertLead, listLeads, updateLead, getLead } from "./db.js";
import { parseLeadMessage } from "./parseLead.js";
import { startBot } from "./bot.js";


/**
 * @param {import("express").Express} app
 * @param {number} startPort
 * @param {{ strict?: boolean, maxAttempts?: number }} [options]
 */
function listenApp(app, startPort, options = {}) {
  const strict = !!options.strict;
  const maxAttempts = options.maxAttempts ?? 25;

  return new Promise((resolve, reject) => {
    let port = Number(startPort) || 5178;
    const cap = strict ? port : port + maxAttempts - 1;

    function bind() {
      const server = http.createServer(app);

      server.once("error", (err) => {
        server.close();
        if (strict || err.code !== "EADDRINUSE" || port >= cap) {
          reject(err);
          return;
        }
        // eslint-disable-next-line no-console
        console.warn(
          `[HTTP] Port ${port} band; ${port + 1}-port sinayapmiz…`
        );
        port++;
        bind();
      });

      server.once("listening", () => {
        resolve({ server, port });
      });

      server.listen(port);
    }

    bind();
  });
}

async function main() {
  await connectMongo();

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  const publicDir = path.resolve(process.cwd(), "public");
  app.use("/", express.static(publicDir));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/leads", async (req, res, next) => {
    try {
      const holat = req.query.holat ? String(req.query.holat) : "hammasi";
      const q = req.query.q ? String(req.query.q) : "";
      const limit = req.query.limit ? Number(req.query.limit) : 200;
      const offset = req.query.offset ? Number(req.query.offset) : 0;
      const items = await listLeads({ holat, q, limit, offset });
      res.json({ items });
    } catch (e) {
      next(e);
    }
  });

  app.get("/api/leads/:id", async (req, res, next) => {
    try {
      const id = req.params.id;
      const lead = await getLead(id);
      if (!lead) return res.status(404).json({ error: "not_found" });
      res.json({ lead });
    } catch (e) {
      next(e);
    }
  });

  app.patch("/api/leads/:id", async (req, res, next) => {
    try {
      const id = req.params.id;
      const schema = z
        .object({
          holat: z
            .enum([
              "yangi",
              "qongiroq_qilingan",
              "javob_yoq",
              "notogri_raqam",
              "qiziqdi",
              "qiziqmadi",
              "uchrashuv_belgilandi",
              "keyinroq"
            ])
            .optional(),
          izoh: z.string().max(2000).optional(),
          muammo_sababi: z.string().max(2000).optional(),
          uchrashuv_vaqti: z.string().max(64).optional()
        })
        .strict();

      const parsed = schema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: "bad_request" });
      }

      const updated = await updateLead(id, parsed.data);
      if (!updated) return res.status(404).json({ error: "not_found" });
      res.json({ lead: updated });
    } catch (e) {
      next(e);
    }
  });

  app.post("/api/ingest/telegram", async (req, res, next) => {
    try {
      const schema = z
        .object({
          source_chat_id: z.string().optional(),
          source_message_id: z.string().optional(),
          text: z.string().min(1)
        })
        .strict();
      const parsed = schema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: "bad_request" });
      }

      const payload = parseLeadMessage(parsed.data.text);
      const result = await insertLead({
        sourceChatId: parsed.data.source_chat_id ?? null,
        sourceMessageId: parsed.data.source_message_id ?? null,
        rawText: parsed.data.text,
        payload
      });
      res.json({ ok: true, ...result });
    } catch (e) {
      next(e);
    }
  });

  app.use((err, _req, res, _next) => {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: "server_error" });
  });

  const strictPort = ["1", "true", "yes"].includes(
    String(process.env.STRICT_PORT ?? "").toLowerCase()
  );
  const startPort = process.env.PORT ? Number(process.env.PORT) : 5178;

  let actualPort;
  try {
    const { port } = await listenApp(app, startPort, {
      strict: strictPort,
      maxAttempts: 25
    });
    actualPort = port;
  } catch (err) {
    if (err?.code === "EADDRINUSE") {
      // eslint-disable-next-line no-console
      console.error(
        `[HTTP] Port ${startPort} band. Eski serverni toʻxtating yoki .env da PORT ni oʻzgartiring (yoki STRICT_PORT=0 va avtomatik port tanlash).`
      );
    }
    throw err;
  }

  // eslint-disable-next-line no-console
  console.log(`CRM server: http://localhost:${actualPort}`);

function keepAlivePing() {
  https.get("https://ebeluxurycrm.onrender.com/", (res) => {
    console.log(`[keepalive] ${new Date().toISOString()} – status: ${res.statusCode}`);
    res.resume();
  }).on("error", (err) => {
    console.error(`[keepalive] ${new Date().toISOString()} – error: ${err.message}`);
  });
}
keepAlivePing();
setInterval(keepAlivePing, 10 * 60 * 1000);

  const botStatus = startBot();
  if (!botStatus.started) {
    // eslint-disable-next-line no-console
    console.log(`Bot started: no (${botStatus.reason})`);
  } else {
    // eslint-disable-next-line no-console
    console.log("Bot started: yes");
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Serverni ishga tushirib boʻlmadi:", err.message);
  process.exit(1);
});
