/**
 * Standalone Telegram Authentication Script
 * 
 * Run: node src/auth-telegram.js
 * 
 * Authenticates with Telegram, handles FLOOD_WAIT automatically,
 * and saves the session string to .env.
 */

import "dotenv/config";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import readline from "readline";
import fs from "fs";
import path from "path";

const API_ID = parseInt(process.env.TELEGRAM_API_ID || "39016248");
const API_HASH = process.env.TELEGRAM_API_HASH || "ebabc82d33b6daa9db6d1813a71a0fdf";
const PHONE = process.env.TELEGRAM_PHONE || "+998978200492";

function ask(question) {
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

async function main() {
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║  📱 Telegram Autentifikatsiya Skripti            ║");
  console.log("╠══════════════════════════════════════════════════╣");
  console.log(`║  API_ID:  ${API_ID}`);
  console.log(`║  PHONE:   ${PHONE}`);
  console.log("╚══════════════════════════════════════════════════╝\n");

  const session = new StringSession("");

  const client = new TelegramClient(session, API_ID, API_HASH, {
    connectionRetries: 5,
    retryDelay: 1000,
    requestRetries: 3,
    timeout: 60000,
    useIPv6: false,
    // Auto-sleep up to 600 seconds (10 min) on FLOOD_WAIT
    floodSleepThreshold: 600,
  });

  // Track if phoneNumber callback was already called once
  // to prevent infinite retry loops
  let phoneNumberAttempts = 0;

  try {
    console.log("⏳ Telegram serveriga ulanilmoqda...");
    console.log("   (FLOOD_WAIT bo'lsa avtomatik kutiladi)\n");

    await client.start({
      phoneNumber: async () => {
        phoneNumberAttempts++;
        if (phoneNumberAttempts > 2) {
          throw new Error("STOP: Ko'p urinish. Qaytadan skriptni boshlang.");
        }
        console.log(`📞 Telefon raqam: ${PHONE}`);
        return PHONE;
      },
      phoneCode: async () => {
        console.log("\n╔══════════════════════════════════════════════════╗");
        console.log("║  📨 KOD YUBORILDI!                               ║");
        console.log("║                                                    ║");
        console.log("║  Quyidagi joylarni tekshiring:                    ║");
        console.log("║  1️⃣  Telegram ilovasi → 'Telegram' xabarlari     ║");
        console.log("║  2️⃣  SMS xabarlar                                ║");
        console.log("║  3️⃣  Boshqa qurilmadagi Telegram                 ║");
        console.log("║                                                    ║");
        console.log("║  ⏱️  Kod 5 daqiqacha amal qiladi                 ║");
        console.log("╚══════════════════════════════════════════════════╝\n");

        const code = await ask("5 raqamli KODNI kiriting: ");
        if (!code || code.length < 4) {
          throw new Error("Kod kiritilmadi yoki juda qisqa");
        }
        return code;
      },
      password: async () => {
        console.log("\n🔒 2FA parol talab qilinmoqda...");
        const pwd = await ask("2FA PAROL: ");
        if (!pwd) throw new Error("Parol kiritilmadi");
        return pwd;
      },
      forceSMS: true,
      onError: (err) => {
        // Don't throw — just log. Let gramJS handle retries.
        console.error("⚠️  Xato:", err.message);
      },
    });

    // Success!
    const newSession = client.session.save();

    console.log("\n╔══════════════════════════════════════════════════╗");
    console.log("║  ✅ MUVAFFAQIYATLI ULANDI!                       ║");
    console.log("╚══════════════════════════════════════════════════╝\n");

    console.log("📋 SESSION STRING:\n");
    console.log(newSession);
    console.log("\n");

    // Auto-save to .env
    const envPath = path.resolve(process.cwd(), ".env");
    try {
      let envContent = fs.readFileSync(envPath, "utf8");
      if (envContent.includes("TELEGRAM_SESSION=")) {
        envContent = envContent.replace(
          /TELEGRAM_SESSION=.*/,
          `TELEGRAM_SESSION=${newSession}`
        );
      } else {
        envContent += `\nTELEGRAM_SESSION=${newSession}\n`;
      }
      fs.writeFileSync(envPath, envContent, "utf8");
      console.log("✅ .env fayliga avtomatik saqlandi!");
      console.log("   Endi serverni qayta boshlang: npm start\n");
    } catch (e) {
      console.error("⚠️  .env fayliga saqlashda xato:", e.message);
      console.log("   Yuqoridagi SESSION STRING ni qo'lda .env ga joylashtiring.\n");
    }

    // Show user info
    try {
      const me = await client.getMe();
      console.log(`👤 Siz: ${me.firstName || ""} ${me.lastName || ""} (@${me.username || "yoq"})`);
      console.log(`📞 Tel: +${me.phone}\n`);
    } catch {
      // ignore
    }

    await client.disconnect();

  } catch (err) {
    console.error("\n❌ AUTENTIFIKATSIYA XATOSI:", err.message);

    const waitMatch = String(err.message).match(/(\d+) seconds/i);
    if (err.message.includes("FLOOD") || waitMatch) {
      const secs = waitMatch ? parseInt(waitMatch[1]) : "?";
      console.error(`\n⚠️  Telegram FLOOD_WAIT: ${secs} soniya kutish kerak.`);
      console.error(`   ${Math.ceil(secs / 60)} daqiqa kutib qaytadan urinib ko'ring.\n`);
    } else if (err.message.includes("PHONE_NUMBER_INVALID")) {
      console.error(`\n⚠️  Telefon raqam noto'g'ri: ${PHONE}\n`);
    } else if (err.message.includes("PHONE_CODE_INVALID")) {
      console.error("\n⚠️  Kiritilgan kod noto'g'ri. Qaytadan urinib ko'ring.\n");
    } else if (err.message.includes("PHONE_CODE_EXPIRED")) {
      console.error("\n⚠️  Kod muddati o'tgan. Qaytadan urinib ko'ring.\n");
    }

    try { await client.disconnect(); } catch { /* ignore */ }
    process.exit(1);
  }

  process.exit(0);
}

main();
