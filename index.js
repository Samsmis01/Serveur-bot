import 'dotenv/config'
import express from 'express'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import pino from 'pino'
import makeWASocket, {
  Browsers,
  DisconnectReason,
  useMultiFileAuthState
} from '@whiskeysockets/baileys'

const app = express()
const log = pino({ level: process.env.LOG_LEVEL || 'info' })
const PORT = Number(process.env.PORT || 3000)
const API_KEY = process.env.PAIRING_API_KEY || ''
const SESSIONS_DIR = path.resolve(process.env.SESSIONS_DIR || '../shared/sessions')
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*'
const TIMEOUT = Number(process.env.PAIRING_TIMEOUT_MS || 120000)

await fs.mkdir(SESSIONS_DIR, { recursive: true })

app.use(express.json({ limit: '32kb' }))
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN)
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

const attempts = new Map()
const sockets = new Map()

function auth(req, res, next) {
  if (!API_KEY) return res.status(500).json({ ok: false, error: 'PAIRING_API_KEY is not configured' })
  if (req.get('x-api-key') !== API_KEY) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' })
  }
  next()
}

function normalizePhone(input) {
  const value = String(input || '').replace(/\D/g, '')
  if (!/^\d{8,15}$/.test(value)) return null
  return value
}

function safeSessionDir(phone) {
  return path.join(SESSIONS_DIR, phone)
}

function maskPhone(phone) {
  return phone.length <= 4 ? '****' : `${'*'.repeat(Math.max(0, phone.length - 4))}${phone.slice(-4)}`
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'atomic-core-pairing', time: new Date().toISOString() })
})

app.post('/api/pair', auth, async (req, res) => {
  const phone = normalizePhone(req.body?.phone)
  if (!phone) return res.status(400).json({ ok: false, error: 'Numéro invalide. Utilise le format international sans +.' })

  if (sockets.has(phone)) {
    return res.status(409).json({ ok: false, error: 'Une demande de pairing est déjà en cours pour ce numéro.' })
  }

  const last = attempts.get(phone) || 0
  if (Date.now() - last < 30000) {
    return res.status(429).json({ ok: false, error: 'Attends 30 secondes avant une nouvelle demande.' })
  }
  attempts.set(phone, Date.now())

  const sessionDir = safeSessionDir(phone)
  await fs.mkdir(sessionDir, { recursive: true })
  // Prevent Server 2 from taking the session while Server 1 is completing pairing.
  const pairingMarker = path.join(sessionDir, '.pairing')
  await fs.writeFile(pairingMarker, JSON.stringify({ startedAt: new Date().toISOString() }))

  let state, saveCreds
  try {
    ({ state, saveCreds } = await useMultiFileAuthState(sessionDir))
  } catch (error) {
    log.error({ err: error }, 'auth state initialization failed')
    return res.status(500).json({ ok: false, error: 'Impossible d initialiser la session.' })
  }

  if (state.creds.registered) {
    return res.status(409).json({ ok: false, error: 'Ce numéro possède déjà une session enregistrée. Supprime sa session avant de le relier.' })
  }

  let sock
  let timeout
  let settled = false

  const cleanup = async () => {
    if (timeout) clearTimeout(timeout)
    sockets.delete(phone)
  }

  try {
    sock = makeWASocket({
      auth: state,
      browser: Browsers.macOS('Chrome'),
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000
    })

    sockets.set(phone, sock)
    sock.ev.on('creds.update', saveCreds)

    const code = await sock.requestPairingCode(phone)
    const formatted = code?.match(/.{1,4}/g)?.join('-') || code

    res.json({
      ok: true,
      phone: maskPhone(phone),
      code: formatted,
      expiresInSeconds: Math.round(TIMEOUT / 1000),
      message: 'Entre ce code dans WhatsApp > Appareils connectés > Lier avec un numéro de téléphone.'
    })

    timeout = setTimeout(async () => {
      if (settled) return
      settled = true
      log.warn({ phone: maskPhone(phone) }, 'pairing timeout')
      try { sock.ws?.close() } catch {}
      await cleanup()
    }, TIMEOUT)

    sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
      if (connection === 'open' && !settled) {
        settled = true
        log.info({ phone: maskPhone(phone) }, 'pairing successful')

        // Confirmation is sent only to the number that explicitly paired.
        try {
          await sock.sendMessage(`${phone}@s.whatsapp.net`, {
            text: '✅ Connexion réussie ! Ton numéro est maintenant lié à ATOMIC CORE. Le bot va démarrer automatiquement.'
          })
        } catch (error) {
          log.warn({ err: error }, 'confirmation message failed')
        }

        // Release the pairing lock. Server 2 will discover the registered session.
        await fs.rm(pairingMarker, { force: true })

        setTimeout(async () => {
          try { sock.ws?.close() } catch {}
          await cleanup()
        }, 5000)
      }

      if (connection === 'close' && !settled) {
        const status = lastDisconnect?.error?.output?.statusCode
        if (status === DisconnectReason.loggedOut) {
          settled = true
          await fs.rm(pairingMarker, { force: true }).catch(() => {})
          await cleanup()
        }
      }
    })
  } catch (error) {
    await fs.rm(pairingMarker, { force: true }).catch(() => {})
    await cleanup()
    log.error({ err: error }, 'pairing request failed')
    if (!res.headersSent) {
      return res.status(500).json({ ok: false, error: 'Impossible de générer le code de pairing.' })
    }
  }
})

app.listen(PORT, () => {
  log.info({ port: PORT }, 'Atomic Core pairing server listening')
})

process.on('SIGINT', async () => {
  for (const sock of sockets.values()) {
    try { sock.ws?.close() } catch {}
  }
  process.exit(0)
})
