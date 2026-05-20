const KEY_MAP = [
  { re: /^ismi\s*:/i, key: "ismi" },
  { re: /^tel\s*:/i, key: "tel" },
  { re: /^qayerdan\s*:/i, key: "qayerdan" },
  { re: /^tuman\s*:/i, key: "tuman" },
  { re: /^(kv\/m|kv\s*\/\s*m|kv\/m\s*|kv\/m\s*)\s*:/i, key: "kv_m" },
  { re: /^qoshimcha\s*nomer\s*:/i, key: "qoshimcha_nomer" }
];

function norm(s) {
  return String(s ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
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

  // Header example:
  // 05.05.2026 | 17:05
  // KSK- YANVAR
  // прямой интерес
  // отзыв
  // ig
  if (lines.length) {
    const header = [];
    for (const l of lines) {
      if (/^\w+.*:/.test(l)) break;
      header.push(l);
      if (header.length >= 5) break;
    }

    if (header[0]) payload.lead_vaqti = header[0];
    if (header[1]) payload.kampaniya = header[1];
    if (header[2]) payload.qiziqish = header[2];
    if (header[3]) payload.feedback = header[3];
    if (header[4]) payload.kanal = header[4];
  }

  for (const line of lines) {
    const kv = trySplitKeyValue(line);
    if (!kv) continue;

    for (const { re, key } of KEY_MAP) {
      if (re.test(kv.left + ":")) {
        payload[key] = kv.right || null;
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
