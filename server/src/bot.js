import TelegramBot from "node-telegram-bot-api";
import { parseLeadMessage } from "./parseLead.js";
import { insertLead } from "./db.js";

function getEnv(name) {
  const v = process.env[name];
  return v && String(v).trim() ? String(v).trim() : null;
}

function telegramEnabledFromEnv() {
  const raw = process.env.TELEGRAM_ENABLED;
  if (raw == null || String(raw).trim() === "") return true;
  const s = String(raw).trim().toLowerCase();
  return !["0", "false", "no", "off"].includes(s);
}

export function startBot() {
  if (!telegramEnabledFromEnv()) {
    return { started: false, reason: "TELEGRAM_ENABLED=off" };
  }

  const token = getEnv("TELEGRAM_BOT_TOKEN");
  if (!token) {
    return { started: false, reason: "TELEGRAM_BOT_TOKEN not set" };
  }

  const allowedChatId = getEnv("TELEGRAM_ALLOWED_CHAT_ID") || "-5085592834"; // optional fallback
  if (allowedChatId) {
    // eslint-disable-next-line no-console
    console.log(`[Telegram] Faqat guruh/chat id: ${allowedChatId}`);
  }
  const bot = new TelegramBot(token, { polling: true });

  let pollingStopped = false;
  bot.on("polling_error", (err) => {
    if (pollingStopped) return;
    const text = `${err?.message ?? err}`;
    const isConflict = /409|terminated by other getUpdates/i.test(text);
    if (!isConflict) return;
    pollingStopped = true;
    try {
      bot.stopPolling();
    } catch {
      //
    }
    // eslint-disable-next-line no-console
    console.error(
      "[Telegram] 409 Conflict: boshqa joyda ham shu bot token bilan polling ishlayapti. " +
        "Bitta nusxa qoldiring: boshqa terminal/Task Managerdan eski «node npm run dev» ni toʻxtating, " +
        "yoki ikkinchi serverda `.env`: TELEGRAM_ENABLED=0."
    );
  });

  const handleMessage = async (msg) => {
    try {
      const chatId = msg?.chat?.id != null ? String(msg.chat.id) : null;
      const messageId =
        msg?.message_id != null ? String(msg.message_id) : null;

      const chatType = msg?.chat?.type; // 'private', 'group', 'supergroup', etc.
      console.log(`[Telegram Debug] RAW XABAR OLINDI. Chat ID: ${chatId} (Type: ${chatType}), Xabar ID: ${messageId}`);

      if (!chatId || !messageId) return;

      const text = msg?.text || msg?.caption;

      // Xabar qabul qilingani haqida terminalda belgi (BAHR QANDAY xabarni ko'rsatish uchun yuqoriga qo'yildi)
      console.log(`\n========== YANGI XABAR KELDI ==========`);
      console.log(`Chat ID: ${chatId} | Type: ${chatType}`);
      console.log(`Matn:\n${text}`);
      console.log(`=======================================\n`);

      // START buyrug'i uchun salomlashish
      if (text === "/start") {
        bot.sendMessage(chatId, "Assalomu alaykum! Men Call Center CRM botiman. Leadlarni avtomatik qabul qilib saqlayman.");
        return;
      }

      // TEMPORARILY DISABLED: Allow any chat to send messages for testing
      /*
      if (allowedChatId && chatId !== allowedChatId) {
        console.log(`[Telegram Debug] Xabar rad etildi. Ruxsat etilgan chat: ${allowedChatId}, lekin xabar kelgan chat: ${chatId}`);
        return;
      }
      */

      if (!text || typeof text !== "string") {
        console.log("[Telegram Debug] Matnli xabar emas, rad etildi.");
        return;
      }

      // Heuristic: only ingest messages that look like the form
      if (!/Ismi\s*:/i.test(text) && !/Tel\s*:/i.test(text)) {
        console.log("[Telegram Debug] Xabar tarkibida 'Ismi:' yoki 'Tel:' topilmadi, rad etildi.");
        return;
      }

      const payload = parseLeadMessage(text);
      console.log(`[Telegram Debug] Xabar tahlil qilindi (Parsed Payload):\n`, JSON.stringify(payload, null, 2));

      const res = await insertLead({
        sourceChatId: chatId,
        sourceMessageId: messageId,
        rawText: text,
        payload
      });
      
      if (res.created) {
        console.log(`[Telegram] Yangi xabar olindi va Mongo DB ga saqlandi! Ismi: ${payload.ismi || "Noma'lum"}, Tel: ${payload.tel || "Noma'lum"}`);
      } else if (res.reason === "duplicate") {
        console.log(`[Telegram] Bu xabar allaqachon DB da mavjud (chatId: ${chatId}, msgId: ${messageId}).`);
      }
    } catch (e) {
      console.error("[Telegram] Xatolik yuz berdi:", e);
      // swallow; bot should keep running
    }
  };

  bot.on("message", handleMessage);
  bot.on("channel_post", handleMessage);

  return { started: true };
}

