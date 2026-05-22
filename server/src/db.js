import { MongoClient, ObjectId } from "mongodb";

let client;
/** @type {import("mongodb").Collection} */
export let leadsCol;

/** @param {string} uri */
function uriHostForLog(uri) {
  const m = uri.match(/^mongodb(?:\+srv)?:\/\/[^@]+@([^/?]+)/);
  return m ? m[1] : "nomalum";
}

/** Parol chiqmasligi uchun URI ni maskalash */
function uriMaskedForLog(uri) {
  try {
    return String(uri).replace(/:([^@/]+)@/, ":***@");
  } catch {
    return "(masklangan)";
  }
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toIso(v) {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  return typeof v === "string" ? v : null;
}

/** @param {{ _id?: import("mongodb").ObjectId | unknown } | null | undefined} doc */
export function mapLead(doc) {
  if (!doc?._id) return null;
  const { _id, ...rest } = doc;
  const out = { ...rest, id: String(_id) };
  out.created_at = toIso(rest.created_at) ?? rest.created_at;
  out.oxirgi_ozgarish_at =
    toIso(rest.oxirgi_ozgarish_at) ?? rest.oxirgi_ozgarish_at ?? null;
  return out;
}

export async function connectMongo() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error("MONGODB_URI o‘rnatilmagan (.env)");
  }

  client = new MongoClient(uri);
  await client.connect();

  const dbName = process.env.MONGODB_DB?.trim();
  const db = dbName ? client.db(dbName) : client.db();

  const actualDbName = db.databaseName;
  leadsCol = db.collection("leads");

  await db.command({ ping: 1 });

  await leadsCol.createIndex({ created_at: -1 }, { name: "created_at_desc" });
  await leadsCol.createIndex({ holat: 1 }, { name: "holat" });
  await leadsCol.createIndex(
    { source_chat_id: 1, source_message_id: 1 },
    {
      unique: true,
      name: "unique_telegram_message",
      partialFilterExpression: {
        source_chat_id: { $exists: true, $type: "string", $gt: "" },
        source_message_id: { $exists: true, $type: "string", $gt: "" }
      }
    }
  );

  const host = uriHostForLog(uri);
  // eslint-disable-next-line no-console
  console.log(
    `[MongoDB] Ulandi | host=${host} | bazalar=${actualDbName} | kolleksiya=leads | ping=OK`
  );
  // eslint-disable-next-line no-console
  console.log(`[MongoDB] URI (faqat koʻrinish): ${uriMaskedForLog(uri)}`);

  try {
    const n = await leadsCol.estimatedDocumentCount();
    // eslint-disable-next-line no-console
    console.log(`[MongoDB] leadlar_taxminiy=${n}`);
  } catch {
    // ignore
  }
}

/** @param {{ sourceChatId?: string | null, sourceMessageId?: string | null, rawText: string, payload?: object }} p */
export async function insertLead({
  sourceChatId,
  sourceMessageId,
  rawText,
  payload
}) {
  const now = new Date();
  const doc = {
    created_at: now,
    source_chat_id: sourceChatId ?? null,
    source_message_id: sourceMessageId ?? null,
    raw_text: rawText,
    payload_json: payload ?? {},
    ismi: payload?.ismi ?? null,
    tel: payload?.tel ?? null,
    qayerdan: payload?.qayerdan ?? null,
    tuman: payload?.tuman ?? null,
    kv_m: payload?.kv_m ?? null,
    qoshimcha_nomer: payload?.qoshimcha_nomer ?? null,
    kampaniya: payload?.kampaniya ?? null,
    lead_vaqti: payload?.lead_vaqti ?? null,
    qiziqish: payload?.qiziqish ?? null,
    feedback: payload?.feedback ?? null,
    kanal: payload?.kanal ?? null,
    holat: "yangi",
    izoh: null,
    muammo_sababi: null,
    uchrashuv_vaqti: null,
    oxirgi_ozgarish_at: now
  };

  try {
    const r = await leadsCol.insertOne(doc);
    return { id: String(r.insertedId), created: true };
  } catch (e) {
    if (e?.code === 11000)
      return { id: null, created: false, reason: "duplicate" };
    throw e;
  }
}

export async function listLeads({ holat, q, limit = 200, offset = 0 }) {
  /** @type {import("mongodb").Filter<import("mongodb").Document>} */
  const filter = {};
  if (holat && holat !== "hammasi") filter.holat = holat;
  if (q?.trim()) {
    const rx = new RegExp(escapeRegex(q.trim()), "i");
    filter.$or = [
      { ismi: rx },
      { tel: rx },
      { tuman: rx },
      { qayerdan: rx }
    ];
  }

  const rows = await leadsCol
    .find(filter)
    .sort({ created_at: -1 })
    .skip(Math.max(0, offset))
    .limit(Math.min(500, Math.max(1, limit)))
    .toArray();

  return rows.map((d) => mapLead(d)).filter(Boolean);
}

export async function getLead(idStr) {
  if (!ObjectId.isValid(idStr)) return null;
  const doc = await leadsCol.findOne({ _id: new ObjectId(idStr) });
  return doc ? mapLead(doc) : null;
}

/** @param {string} idStr */
export async function updateLead(idStr, patch) {
  if (!ObjectId.isValid(idStr)) return null;
  const now = new Date();
  const allowed = ["holat", "izoh", "muammo_sababi", "uchrashuv_vaqti"];
  const $set = { oxirgi_ozgarish_at: now };
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(patch, k) && patch[k] !== undefined) {
      $set[k] = patch[k];
    }
  }

  await leadsCol.updateOne({ _id: new ObjectId(idStr) }, { $set });

  const doc = await leadsCol.findOne({ _id: new ObjectId(idStr) });
  return doc ? mapLead(doc) : null;
}
