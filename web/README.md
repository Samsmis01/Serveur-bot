# HEXTECH pairing website

Deploy this folder to Vercel.

Vercel project environment variables:
- `PAIRING_SERVER_URL` = public HTTPS URL of Server 1
- `PAIRING_API_KEY` = same secret as Server 1

The browser never receives the API key. The Vercel serverless function proxies `/api/pair` to Server 1.
