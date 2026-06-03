import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { parseLeadMessage } from "./parseLead.js";
import { insertLead } from "./db.js";
import readline from "readline";

function getEnv(name) {
  const v = process.env[name];
  return v && String(v).trim() ? String(v).trim() : null;
}

function telegramClientEnabledFromEnv() {
  const raw = process.env.TELEGRAM_CLIENT_ENABLED;
  if (raw == null || String(raw).trim() === "") return true;
  const s = String(raw).trim().toLowerCase();
  return !["0", "false", "no", "off"].includes(s);
}

// Helper function to read input from stdin
function promptForInput(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

let client = null;
let isConnected = false;

/**
 * Connect to Telegram as a real user account
 * Requires: TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_PHONE, TELEGRAM_SESSION
 * On first connection, you'll receive a code via Telegram which you need to enter
 */
export async function connectTelegramClient() {
  if (!telegramClientEnabledFromEnv()) {
    // eslint-disable-next-line no-console
    console.log("[Telegram Client] Disabled (TELEGRAM_CLIENT_ENABLED=off)");
    return { connected: false, reason: "disabled" };
  }

  const apiId = getEnv("TELEGRAM_API_ID");
  const apiHash = getEnv("TELEGRAM_API_HASH");
  const phoneNumber = getEnv("TELEGRAM_PHONE");
  const sessionString = getEnv("TELEGRAM_SESSION") || "";

  // eslint-disable-next-line no-console
  console.log("[Telegram Client] Credentials check:");
  // eslint-disable-next-line no-console
  console.log(`  - API_ID: ${apiId ? "✓" : "✗"}`);
  // eslint-disable-next-line no-console
  console.log(`  - API_HASH: ${apiHash ? "✓" : "✗"}`);
  // eslint-disable-next-line no-console
  console.log(`  - PHONE: ${phoneNumber ? "✓ " + phoneNumber : "✗"}`);
  // eslint-disable-next-line no-console
  console.log(`  - SESSION: ${sessionString ? "✓ (exists)" : "✗ (empty - first login)"}`);

  if (!apiId || !apiHash) {
    // eslint-disable-next-line no-console
    console.error(
      "[Telegram Client] ❌ TELEGRAM_API_ID va TELEGRAM_API_HASH talab qilinadi"
    );
    // eslint-disable-next-line no-console
    console.error("    1. Go to https://my.telegram.org");
    // eslint-disable-next-line no-console
    console.error("    2. Login with your phone");
    // eslint-disable-next-line no-console
    console.error("    3. Click 'API development tools'");
    // eslint-disable-next-line no-console
    console.error("    4. Copy API_ID and API_HASH to .env");
    return { connected: false, reason: "missing_credentials" };
  }

  if (!phoneNumber) {
    // eslint-disable-next-line no-console
    console.error(
      "[Telegram Client] ❌ TELEGRAM_PHONE talab qilinadi (masalan: +998901234567)"
    );
    return { connected: false, reason: "missing_phone" };
  }

  try {
    const session = new StringSession(sessionString);

    client = new TelegramClient(session, parseInt(apiId), apiHash, {
      connectionRetries: 5,
      retryDelay: 500,
      requestRetries: 3,
      timeout: 30000,
      useIPv6: false,
    });

    // eslint-disable-next-line no-console
    console.log("[Telegram Client] ⏳ Ulanishga harakat qilinyapmiz...");

    await client.start({
      phoneNumber: async () => {
        // eslint-disable-next-line no-console
        console.log("[Telegram Client] Phone number provided:", phoneNumber);
        return phoneNumber;
      },
      phoneCode: async () => {
        // eslint-disable-next-line no-console
        console.log("\n");
        // eslint-disable-next-line no-console
        console.log("╔════════════════════════════════════════════════════════╗");
        // eslint-disable-next-line no-console
        console.log("║  📱 CODE CHI TELEGRAM GA YUBORILDI!                   ║");
        // eslint-disable-next-line no-console
        console.log("║                                                        ║");
        // eslint-disable-next-line no-console
        console.log("║  📲 Telegram app-ni oching va kodni qidiring           ║");
        // eslint-disable-next-line no-console
        console.log("║     (SMS yoki Telegram Message sifatida kelishi mumkin)║");
        // eslint-disable-next-line no-console
        console.log("║                                                        ║");
        // eslint-disable-next-line no-console
        console.log("║  ⏱️  Kod 5 daqiqacha amal qiladi                      ║");
        // eslint-disable-next-line no-console
        console.log("╚════════════════════════════════════════════════════════╝\n");
        
        const code = await promptForInput(
          "KOD ni kiriting (5 rasmni): "
        );
        if (!code) throw new Error("Code is empty");
        return code;
      },
      password: async () => {
        // 2FA parol agar kerak bo'lsa
        // eslint-disable-next-line no-console
        console.log("\n");
        // eslint-disable-next-line no-console
        console.log("╔════════════════════════════════════════════════════════╗");
        // eslint-disable-next-line no-console
        console.log("║  🔒 2FA PAROL KERAK!                                   ║");
        // eslint-disable-next-line no-console
        console.log("║                                                        ║");
        // eslint-disable-next-line no-console
        console.log("║  Settings → Privacy and Security → Two-Step Verification ║");
        // eslint-disable-next-line no-console
        console.log("║  da o'rnatgan parolni kiriting                         ║");
        // eslint-disable-next-line no-console
        console.log("╚════════════════════════════════════════════════════════╝\n");
        
        const pwd = await promptForInput(
          "2FA PAROL ni kiriting: "
        );
        if (!pwd) throw new Error("Password is empty");
        return pwd;
      },
      forceSMS: true,  // Force SMS delivery instead of in-app message
      onError: (err) => {
        // eslint-disable-next-line no-console
        console.error("[Telegram Client] ❌ Xato:", err.message);
        throw err;
      },
    });

    isConnected = true;

    // Yangi session string saqla (keyingi ulanish uchun)
    const newSessionString = client.session.save();
    // eslint-disable-next-line no-console
    console.log(
      "[Telegram Client] ✅ YANGI SESSION (Bu string-ni .env ga joylashtiring):\n",
      newSessionString
    );

    // eslint-disable-next-line no-console
    console.log("[Telegram Client] ✅ Muvaffaqiyatli ulandi!");

    return { connected: true };
  } catch (err) {
    isConnected = false;
    // eslint-disable-next-line no-console
    console.error(
      "\n╔════════════════════════════════════════════════════════╗"
    );
    // eslint-disable-next-line no-console
    console.error(
      "║  ❌ TELEGRAM ULANISH XATOSI                          ║"
    );
    // eslint-disable-next-line no-console
    console.error(
      "╚════════════════════════════════════════════════════════╝"
    );
    // eslint-disable-next-line no-console
    console.error("[Error]", err.message);
    
    // Masala turlari bo'yicha tavsiyalar
    const errMsg = String(err?.message || "").toLowerCase();
    
    if (errMsg.includes("code is empty") || errMsg.includes("phone_code_invalid")) {
      // eslint-disable-next-line no-console
      console.error("\n📋 MUAMMO: Kod kiritilmadi yoki noto'g'ri");
      // eslint-disable-next-line no-console
      console.error("✅ YECHIM:");
      // eslint-disable-next-line no-console
      console.error("   1. Telegram app-ni tekshiring (SMS yoki in-app message)");
      // eslint-disable-next-line no-console
      console.error("   2. Kod 5 rasmdan iborat bo'lishi kerak");
      // eslint-disable-next-line no-console
      console.error("   3. Agar kod yo'q bo'lsa:");
      // eslint-disable-next-line no-console
      console.error("      - Internetni tekshiring");
      // eslint-disable-next-line no-console
      console.error("      - Telefon raqamini tekshiring (+998... formatida)");
    } else if (
      errMsg.includes("phone_number_invalid") ||
      errMsg.includes("invalid phone")
    ) {
      // eslint-disable-next-line no-console
      console.error("\n📋 MUAMMO: Noto'g'ri telefon raqami");
      // eslint-disable-next-line no-console
      console.error("✅ YECHIM:");
      // eslint-disable-next-line no-console
      console.error("   .env faylida TELEGRAM_PHONE ning formatini tekshiring");
      // eslint-disable-next-line no-console
      console.error("   To'g'ri format: +998901234567");
      // eslint-disable-next-line no-console
      console.error("   Hozirgi: " + getEnv("TELEGRAM_PHONE"));
    } else if (
      errMsg.includes("not_authenticated") ||
      errMsg.includes("authentication failed")
    ) {
      // eslint-disable-next-line no-console
      console.error("\n📋 MUAMMO: Autentifikatsiya xatosi");
      // eslint-disable-next-line no-console
      console.error("✅ YECHIM:");
      // eslint-disable-next-line no-console
      console.error("   1. TELEGRAM_API_ID ni tekshiring");
      // eslint-disable-next-line no-console
      console.error("   2. TELEGRAM_API_HASH ni tekshiring (my.telegram.org dan oling)");
      // eslint-disable-next-line no-console
      console.error("   3. Akkaunt qushgun ekanini tekshiring");
    } else if (errMsg.includes("connection") || errMsg.includes("timeout")) {
      // eslint-disable-next-line no-console
      console.error("\n📋 MUAMMO: Internet ulanishi xatosi");
      // eslint-disable-next-line no-console
      console.error("✅ YECHIM:");
      // eslint-disable-next-line no-console
      console.error("   1. Internet ulanishini tekshiring");
      // eslint-disable-next-line no-console
      console.error("   2. Proxy/VPN ishlatib ko'ring");
      // eslint-disable-next-line no-console
      console.error("   3. Serverni qayta boshlang");
    }

    return { connected: false, reason: err.message };
  }
}

/**
 * Listen to messages in a group/channel
 * @param {string|number} groupId - Group or channel ID (negative number for groups)
 * @param {Object} options - Configuration options
 * @param {number} [options.offsetId] - Start from message ID (default: 0 - latest messages)
 * @param {number} [options.limit] - How many messages to fetch initially
 * @param {number} [options.pollInterval] - Poll interval in ms (default: 5000)
 * @param {Function} [options.onMessage] - Custom message handler callback
 */
export async function listenToGroupMessages(groupId, options = {}) {
  if (!client || !isConnected) {
    throw new Error(
      "[Telegram Client] Client ulangan emas. connectTelegramClient() chaqirng"
    );
  }

  const {
    offsetId = 0,
    limit = 10,
    pollInterval = 5000,
    onMessage = null,
  } = options;

  // eslint-disable-next-line no-console
  console.log(
    `[Telegram Listener] Guruhni tinglashni boshlash: ${groupId} (interval: ${pollInterval}ms)`
  );

  let lastMessageId = offsetId;
  let isPolling = false;

  const pollMessages = async () => {
    if (isPolling) return;
    isPolling = true;

    try {
      const messages = await client.getMessages(groupId, {
        offsetId: lastMessageId,
        limit: limit,
        reverse: true, // Eng eski xabardan yangi xabargacha
      });

      for (const message of messages) {
        if (!message.message || message.senderId.toString() === String(client.utils.getBotId())) {
          continue; // Bot xabarini o'tkazib yubor
        }

        lastMessageId = message.id;

        // Custom handler callbackni chaqir, agar berilgan bo'lsa
        if (onMessage) {
          await onMessage(message);
          continue;
        }

        // Default: xabarni tahlil qil va bazaga saqla
        await handleIncomingMessage(message);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[Telegram Listener] Xato xabar olishda:`, err.message);
    }

    isPolling = false;
  };

  // Dastlab xabarlarni ol
  await pollMessages();

  // Davomli polling
  const interval = setInterval(pollMessages, pollInterval);

  // Cleaning up function qaytarish
  return () => {
    clearInterval(interval);
    // eslint-disable-next-line no-console
    console.log(`[Telegram Listener] Tinglash to'xtatildi: ${groupId}`);
  };
}

/**
 * Handle incoming message and save to database
 * @param {Object} message - Telegram message object
 */
async function handleIncomingMessage(message) {
  try {
    const text = message.message;
    const chatId = message.peerId?.channelId || message.peerId?.chatId || "unknown";
    const messageId = message.id;
    const senderId = message.senderId;
    const senderUsername = message.sender?.username || "unknown";

    // eslint-disable-next-line no-console
    console.log(`\n========== YANGI XABAR KELDI (Real Account) ==========`);
    // eslint-disable-next-line no-console
    console.log(`Chat ID: ${chatId} | Xabar ID: ${messageId}`);
    // eslint-disable-next-line no-console
    console.log(`Jo'natkuvchi: ${senderUsername} (${senderId})`);
    // eslint-disable-next-line no-console
    console.log(`Matn:\n${text}`);
    // eslint-disable-next-line no-console
    console.log(`===================================================\n`);

    // Heuristic: Faqat lead xabarlarini qabul qil
    if (!/Ismi?\s*:/i.test(text) && !/Tel\s*:/i.test(text)) {
      // eslint-disable-next-line no-console
      console.log(
        "[Telegram] Xabar tarkibida 'Ism:' yoki 'Tel:' topilmadi, rad etildi."
      );
      return;
    }

    // Xabarni tahlil qil
    const payload = parseLeadMessage(text);
    // eslint-disable-next-line no-console
    console.log(
      `[Telegram] Xabar tahlil qilindi:\n`,
      JSON.stringify(payload, null, 2)
    );

    // Bazaga saqla
    const result = await insertLead({
      sourceChatId: String(chatId),
      sourceMessageId: String(messageId),
      rawText: text,
      payload: {
        ...payload,
        source_sender_id: String(senderId),
        source_sender_username: senderUsername,
      },
    });

    if (result.created) {
      // eslint-disable-next-line no-console
      console.log(`[Telegram] Lead saqlandi! ID: ${result.id}`);
    } else {
      // eslint-disable-next-line no-console
      console.warn(
        `[Telegram] Lead saqlash xatosi: ${result.reason || "unknown"}`
      );
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[Telegram] Xabar qayta ishlashda xato:", err.message || err);
  }
}

/**
 * Disconnect from Telegram
 */
export async function disconnectTelegramClient() {
  if (client) {
    await client.disconnect();
    isConnected = false;
    client = null;
    // eslint-disable-next-line no-console
    console.log("[Telegram Client] Ulanish to'xtatildi");
  }
}

/**
 * Get client instance (for advanced usage)
 */
export function getTelegramClient() {
  if (!isConnected) {
    throw new Error("[Telegram Client] Client ulangan emas");
  }
  return client;
}

/**
 * Get connection status
 */
export function isClientConnected() {
  return isConnected && client !== null;
}
