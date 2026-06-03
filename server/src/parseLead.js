const FIELD_MAP = {
  ismi: ["ism", "ismi", "name"],
  tel: ["tel", "phone", "telefon"],
  qayerdan: ["qayerdan", "location", "shahar"],
  tuman: ["tuman", "district"],
  kv_m: ["kv/m", "kv_m", "kv m", "kvadrat", "kvadrat metr"],
  qoshimcha_nomer: ["dop", "qoshimcha nomer", "qoshimcha", "dopolnitelno", "dop nomer"],
  kampaniya: ["nomi", "kampaniya", "campaign"],
  qiziqish: ["ad set name", "qiziqish", "interest"],
  feedback: ["ad name", "feedback"],
  kanal: ["manba", "kanal", "source"],
  lead_vaqti: ["sana", "vaqt", "date", "time", "lead_vaqti"]
};

function norm(s) {
  return String(s ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function cleanKey(keyStr) {
  let s = norm(keyStr);
  // Remove emojis and variation selectors
  s = s.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]|[\uFE00-\uFE0F]/g, "");
  // Remove leading numbers, dots, spaces, dashes: e.g. "1.", "1. ", " 1. - "
  s = s.replace(/^\s*\d+[\.\s\-]+/g, "");
  // Remove trailing and leading punctuation/symbols like ?, :, *
  s = s.replace(/^[\?\s\*\-\:]+|[\?\s\*\-\:]+$/g, "");
  return norm(s).toLowerCase();
}

function cleanValue(valStr) {
  let s = norm(valStr);
  // Remove leading colons, question marks, equals, dashes, spaces
  s = s.replace(/^[:\?\s\=\-]+/g, "");
  return norm(s);
}

function trySplitKeyValue(line) {
  const idx = line.indexOf(":");
  if (idx === -1) return null;
  const left = norm(line.slice(0, idx));
  const right = norm(line.slice(idx + 1));
  return { left, right };
}

export function parseLeadMessage(text) {
  const raw = String(text ?? "");
  const lines = raw
    .split(/\r?\n/)
    .map((l) => norm(l))
    .filter(Boolean);

  const payload = {};

  // For older message formats without colons for the header:
  if (lines.length) {
    const header = [];
    for (const l of lines) {
      if (l.includes(":")) break; // Stop at first line that has a colon (likely a key-value pair)
      if (l.toLowerCase() === "#telegram") continue; // Skip tags
      header.push(l);
      if (header.length >= 5) break;
    }

    if (header[0] && !payload.lead_vaqti) payload.lead_vaqti = header[0];
    if (header[1] && !payload.kampaniya) payload.kampaniya = header[1];
    if (header[2] && !payload.qiziqish) payload.qiziqish = header[2];
    if (header[3] && !payload.feedback) payload.feedback = header[3];
    if (header[4] && !payload.kanal) payload.kanal = header[4];
  }

  // Parse lines with colons (key-value pairs)
  for (const line of lines) {
    const kv = trySplitKeyValue(line);
    if (!kv) continue;

    const cKey = cleanKey(kv.left);
    const cVal = cleanValue(kv.right);

    if (!cVal) continue;

    for (const [field, aliases] of Object.entries(FIELD_MAP)) {
      if (aliases.includes(cKey)) {
        payload[field] = cVal;
        break;
      }
    }
  }

  // Light normalization of phone fields
  if (payload.tel) payload.tel = payload.tel.replace(/\s+/g, "");
  if (payload.qoshimcha_nomer)
    payload.qoshimcha_nomer = payload.qoshimcha_nomer.replace(/\s+/g, "");

  return payload;
}
