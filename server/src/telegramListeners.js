import { connectTelegramClient, listenToGroupMessages, disconnectTelegramClient } from "./telegramClient.js";

let stopListeners = [];
let isStarted = false;

/**
 * Start listening to configured Telegram groups
 * Reads TELEGRAM_GROUP_IDS from environment (comma-separated)
 * Example: TELEGRAM_GROUP_IDS=-1001234567890,-1009876543210
 */
export async function startTelegramListeners() {
  if (isStarted) {
    // eslint-disable-next-line no-console
    console.log("[Telegram Listeners] Allaqachon boshlangan");
    return;
  }

  try {
    // 1. Client ulantirish
    const result = await connectTelegramClient();

    if (!result.connected) {
      // eslint-disable-next-line no-console
      console.warn(
        `[Telegram Listeners] Client ulangan emas: ${result.reason}`
      );
      return { started: false, reason: result.reason };
    }

    // 2. Guruhlarni olish
    const groupIdsEnv = process.env.TELEGRAM_GROUP_IDS || "";
    const groupIds = groupIdsEnv
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (groupIds.length === 0) {
      // eslint-disable-next-line no-console
      console.warn(
        "[Telegram Listeners] TELEGRAM_GROUP_IDS tayin qilinmagan. Hech qaysi guruh tinglanj madi."
      );
      return { started: false, reason: "no_group_ids" };
    }

    // eslint-disable-next-line no-console
    console.log(
      `[Telegram Listeners] ${groupIds.length} ta guruhni tinglashni boshlash...`
    );

    // 3. Har bir guruh uchun listener boshlash
    for (const groupId of groupIds) {
      try {
        const pollInterval =
          parseInt(process.env.TELEGRAM_POLL_INTERVAL || "5000") || 5000;
        const limit = parseInt(process.env.TELEGRAM_FETCH_LIMIT || "10") || 10;

        // eslint-disable-next-line no-console
        console.log(
          `[Telegram Listeners] Guruh tinglashni boshlash: ${groupId} (interval: ${pollInterval}ms, limit: ${limit})`
        );

        const stopListener = await listenToGroupMessages(groupId, {
          pollInterval,
          limit,
          offsetId: 0,
        });

        stopListeners.push(stopListener);

        // eslint-disable-next-line no-console
        console.log(`[Telegram Listeners] ✓ Guruh muvaffaqiyatli boshlandi: ${groupId}`);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(
          `[Telegram Listeners] Guruh tinglashda xato (${groupId}):`,
          err.message
        );
      }
    }

    isStarted = true;

    // eslint-disable-next-line no-console
    console.log(
      `[Telegram Listeners] Barcha guruhlar tinglash uchun tayyorlandi!`
    );

    return { started: true, groups: groupIds.length };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      "[Telegram Listeners] Xato telegramListeners boshlashda:",
      err.message || err
    );
    return { started: false, reason: err.message };
  }
}

/**
 * Stop all Telegram listeners
 */
export async function stopTelegramListeners() {
  if (!isStarted) {
    // eslint-disable-next-line no-console
    console.log("[Telegram Listeners] Allaqachon to'xtatilgan");
    return;
  }

  // eslint-disable-next-line no-console
  console.log(
    `[Telegram Listeners] ${stopListeners.length} ta listenerning barchasini to'xtatyapmiz...`
  );

  for (const stopListener of stopListeners) {
    try {
      if (typeof stopListener === "function") {
        stopListener();
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[Telegram Listeners] Listener to'xtatishda xato:", err.message);
    }
  }

  stopListeners = [];

  try {
    await disconnectTelegramClient();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      "[Telegram Listeners] Client ulanishni kesishda xato:",
      err.message
    );
  }

  isStarted = false;
  // eslint-disable-next-line no-console
  console.log("[Telegram Listeners] Barcha listenerlar to'xtatildi");
}

/**
 * Get status
 */
export function getTelegramListenersStatus() {
  return {
    started: isStarted,
    activeListeners: stopListeners.length,
  };
}
