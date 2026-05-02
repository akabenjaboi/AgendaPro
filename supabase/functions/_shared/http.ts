import { corsHeaders } from "./cors.ts"

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  })
}

export function error(message: string, code: string, status = 400): Response {
  return json({ error: message, code }, status)
}

export function readPathSegments(req: Request, functionName: string): string[] {
  const raw = new URL(req.url).pathname.split("/").filter(Boolean)
  const idx = raw.lastIndexOf(functionName)
  return idx >= 0 ? raw.slice(idx + 1) : raw
}

