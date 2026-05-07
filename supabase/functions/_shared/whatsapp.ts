interface TwilioMessageResponse {
  sid: string
  status?: string
}

export function normalizePhone(raw: string): string {
  const trimmed = raw.trim().replace(/^whatsapp:/i, "")
  const compact = trimmed.replace(/[^\d+]/g, "")
  if (compact.startsWith("+")) return compact
  if (compact.startsWith("00")) return `+${compact.slice(2)}`
  return `+${compact}`
}

function toTwilioAddress(phone: string): string {
  return `whatsapp:${normalizePhone(phone)}`
}

function toBase64(bytes: Uint8Array): string {
  let binary = ""
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

export async function validateTwilioSignature(req: Request, rawBody: string): Promise<boolean> {
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN")
  const signature = req.headers.get("x-twilio-signature")
  if (!authToken || !signature) return false

  const params = new URLSearchParams(rawBody)
  const entries = [...params.entries()].sort(([a], [b]) => a.localeCompare(b))
  let payload = req.url
  for (const [key, value] of entries) payload += `${key}${value}`

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(authToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  )
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))
  const expected = toBase64(new Uint8Array(signed))
  return expected === signature
}

function twilioRequest(params: URLSearchParams): Promise<TwilioMessageResponse> {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID")
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN")

  if (!accountSid || !authToken) {
    throw new Error("Missing Twilio env vars: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN")
  }

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  const authHeader = `Basic ${btoa(`${accountSid}:${authToken}`)}`

  return fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  }).then(async (response) => {
    if (!response.ok) {
      const payload = await response.text()
      throw new Error(`Twilio request failed (${response.status}): ${payload}`)
    }
    const data = await response.json()
    return { sid: data.sid, status: data.status }
  })
}

export async function sendWhatsAppMessage(toPhone: string, body: string): Promise<TwilioMessageResponse> {
  const from = Deno.env.get("TWILIO_WHATSAPP_FROM")
  if (!from) throw new Error("Missing TWILIO_WHATSAPP_FROM")

  const params = new URLSearchParams({
    From: toTwilioAddress(from),
    To: toTwilioAddress(toPhone),
    Body: body,
  })
  return twilioRequest(params)
}

export async function sendWhatsAppTemplate(
  toPhone: string,
  contentSid: string,
  contentVariables: Record<string, string>,
): Promise<TwilioMessageResponse> {
  const from = Deno.env.get("TWILIO_WHATSAPP_FROM")
  if (!from) throw new Error("Missing TWILIO_WHATSAPP_FROM")

  const params = new URLSearchParams({
    From: toTwilioAddress(from),
    To: toTwilioAddress(toPhone),
    ContentSid: contentSid,
    ContentVariables: JSON.stringify(contentVariables),
  })
  return twilioRequest(params)
}
