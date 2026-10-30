// Minimal Claude Messages call shared by the VIN features. Same model and
// endpoint the invoice reader (/api/receive-order/scan) already uses.
type Block = Record<string, unknown>;

export async function askClaudeJson(content: Block[], maxTokens = 400): Promise<Record<string, unknown> | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: maxTokens, messages: [{ role: "user", content }] }),
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const text = Array.isArray(data?.content)
    ? data.content.filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("")
    : "";
  try {
    const m = text.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  } catch {
    return null;
  }
}
