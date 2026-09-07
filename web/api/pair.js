export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' })
  const apiBase = process.env.PAIRING_SERVER_URL
  const apiKey = process.env.PAIRING_API_KEY
  if (!apiBase || !apiKey) return res.status(500).json({ ok: false, error: 'Pairing service is not configured' })

  try {
    const upstream = await fetch(`${apiBase.replace(/\/$/, '')}/api/pair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify(req.body || {})
    })
    const data = await upstream.json()
    return res.status(upstream.status).json(data)
  } catch {
    return res.status(502).json({ ok: false, error: 'Pairing server unavailable' })
  }
}
