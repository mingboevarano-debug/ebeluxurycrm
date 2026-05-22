const path = require('path');
const { parseLeadMessage } = require(path.resolve(__dirname, '..', 'server', 'src', 'parseLead.js'));

const sample = `20.05.2026 | 17:12

KSK- YANVAR

ADV +

отзыв

ig


Ismi: Масуда Мирходжаева

Tel:94 6113146

Qayerdan:тошкент_вилояти

Tuman: Тошкент тумани

Kv/m : 1сотик

Qoshimcha nomer: +998946113146`;

console.log(JSON.stringify(parseLeadMessage(sample), null, 2));
