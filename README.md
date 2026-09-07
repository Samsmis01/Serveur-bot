# HEXTECH CALL — Baileys WhatsApp Bot

Architecture:
- `server-1-pairing/`: API that receives a phone number, generates a WhatsApp pairing code, waits for the account to be linked, sends a confirmation message to that same number, then releases the session to Server 2.
- `server-2-bot/`: persistent bot worker. It loads linked sessions and runs the commands.
- `web/`: HEXTECH CALL pairing website. Deploy this folder to Vercel. A Vercel serverless proxy keeps the Server 1 API key out of the browser.
- `shared/sessions/`: authentication data. **Never publish or commit this directory.**

Commands included:
- `.ping`
- `.antilink on|off`
- `.rank`
- `.status <texte>` (publishes the supplied text as a message in the current group; it does not publish a WhatsApp Story/Status)
- `.welcome on|off`
- `.fakerecording on|off`

Important:
- Use only accounts you own or have explicit permission to operate.
- Baileys is an unofficial WhatsApp Web library and can be affected by WhatsApp changes.
- Node.js 20+ is required by current Baileys documentation.
- Pairing codes must use digits only with the country code and no `+`, spaces, `-`, or parentheses.
- For production, put Server 1 behind HTTPS and protect its API with `PAIRING_API_KEY`.
- If Server 1 and Server 2 are on different machines, use a shared persistent storage layer for sessions (for example a private encrypted volume). Do not put auth files in Git or a public web directory.

## 1. Install

In both server directories:

```bash
npm install
```

## 2. Configure

Copy `.env.example` to `.env` in each server and adjust values.

At minimum:
- `PAIRING_API_KEY` on Server 1 and Vercel
- `PORT`
- `SESSIONS_DIR`
- `BOT_PREFIX` if desired

For a same-VPS setup, use the same absolute `SESSIONS_DIR` for both servers.

## 3. Start Server 2 first

```bash
cd server-2-bot
npm install
npm start
```

## 4. Start Server 1

```bash
cd server-1-pairing
npm install
npm start
```

## 5. Pair from the website

Open `web/index.html` locally or deploy `web/` to Vercel.

Set `PAIRING_SERVER_URL` and `PAIRING_API_KEY` as Vercel project environment variables.

Enter the complete phone number with country code, for example:
`243XXXXXXXXX`

Then enter the generated code in WhatsApp:
WhatsApp → Settings → Linked devices → Link a device → Link with phone number.

## 6. Production process manager

PM2 is recommended:

```bash
npm i -g pm2
cd server-1-pairing && pm2 start index.js --name atomic-pairing
cd ../server-2-bot && pm2 start index.js --name atomic-bot
pm2 save
```

## Security

The `sessions/` directory contains long-lived WhatsApp credentials. Treat it like a private key. Never upload it to GitHub, Vercel, screenshots, or support chats.

This project intentionally does not include bulk messaging, scraping, credential collection, stalkerware, or anti-ban/bypass mechanisms.
