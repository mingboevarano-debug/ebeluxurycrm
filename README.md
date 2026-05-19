# Call Center CRM (Telegram → JSON → Dashboard)

Bu loyiha Telegram guruhdagi lead xabarlarini avtomatik yig‘ib, bazaga yozadi va Uzbek tilidagi admin panelda operatorlar holatlarni belgilashi uchun xizmat qiladi.

## Ishga tushirish

1) Node.js o‘rnatilgan bo‘lsin.

2) Serverni o‘rnatish:

```bash
cd "server"
npm install
```

3) `.env` sozlash (`server/.env`):

```env
PORT=5178
# Faqat ana shu PORT ishlasin, band boʻlsa chiqib ketsin (standartda avtomatik keyingi portga oʻtadi)
# STRICT_PORT=1
TELEGRAM_BOT_TOKEN=YOUR_TOKEN_HERE
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@cluster.../crm?retryWrites=true&w=majority
# bazalar URI dagidan boshqacha boʻlsa:
# MONGODB_DB=crm
# ixtiyoriy: faqat bitta chatdan qabul qilish uchun (guruh ID)
# TELEGRAM_ALLOWED_CHAT_ID=-1001234567890
```

**MongoDB Atlas:** Network Access’da ishlayotgan IP (yoki vaqtinchalik `0.0.0.0/0`) ruxsatli boʻlishi kerak. Username/parolni kodga qo‘ymang — faqat `.env`.

### `409 Conflict` / `getUpdates`

Bir bot token uchun bir vaqtning o‘zida **faqat bitta polling** bo‘lishi mumkin.

- Ikki marta `npm run dev` qolmaganini tekshiring; boshqa Cursor/terminal **`Ctrl+C`** bilan toʻxtating yoki Task Managerdan ortiqcha `node` jarayonini yoping.
- Agar frontend uchun alohida server kerak boʻlsa: ikkinchi nusxa `.env` da `TELEGRAM_ENABLED=0` qo‘ying (Telegram bosilmaydi, API esa ishlayveradi).

4) Ishga tushirish:

```bash
npm run dev
```

5) Admin panel:

- `http://localhost:5178`

## Telegram botni ulash

1) Bot yarating: Telegram’da `@BotFather` → `/newbot` → token oling.

2) Botni guruhga qo‘shing va xabarlarni ko‘ra olishi uchun ruxsat bering:

- Guruh sozlamalarida botga **Read messages** (xabarlarni o‘qish) ruxsati kerak bo‘ladi.
- Agar guruh “Topics/Forum” bo‘lsa ham, bot oddiy `message` event orqali matnlarni oladi.

3) Guruh ID’ni olish (ixtiyoriy, xavfsizlik uchun tavsiya):

- `server/.env` ga `TELEGRAM_ALLOWED_CHAT_ID` qo‘ysangiz, bot faqat shu chatdan ingest qiladi.
- Guruh ID odatda `-100...` ko‘rinishida bo‘ladi. Uni olishning eng oson yo‘li: vaqtincha `TELEGRAM_ALLOWED_CHAT_ID` ni qo‘ymasdan serverni ishga tushiring, lead kelgach bazada `source_chat_id` ko‘rinadi.

## Lead formati (misol)

Telegramga shunday struktura keladi:

```
05.05.2026 | 17:05
KSK- YANVAR
прямой интерес
отзыв
ig

Ismi: Зухра
Tel:909582257
Qayerdan:тошкент
Tuman: Яккасарой
Kv/m : 70 кв
Qoshimcha nomer: +998909582257
```

Server buni parse qilib `leads` jadvaliga saqlaydi.

