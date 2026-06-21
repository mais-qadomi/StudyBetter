import { Router, type IRouter } from "express";

const router: IRouter = Router();

const TOTAL_TIMEOUT_MS = 50_000;
const MAX_RETRY_SLEEP_MS = 12_000;
const MAX_ATTEMPTS = 3;

const systemPrompt = `You are an academic assistant. The user will send you text.

Tasks:
1. Detect the language (arabic, english, or other).
2. If English: provide an Arabic translation AND an Arabic academic explanation.
3. If Arabic or other: provide an Arabic academic explanation only (no translation).

Formatting rules (mandatory):
- Separate each idea or sentence with a blank line.
- Use bullet points (•) for lists or steps.

Always respond in valid JSON with this exact structure:
{
  "language": "arabic" | "english" | "other",
  "translation": "Arabic translation here (null if not English)",
  "explanation": "Arabic academic explanation here"
}`;

function sleepAbortable(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new Error("aborted")); return; }
    const tid = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => { clearTimeout(tid); reject(new Error("aborted")); }, { once: true });
  });
}

async function callGroq(
  apiKey: string,
  text: string,
  signal: AbortSignal,
  attempt = 1
): Promise<{ language: string; translation: string | null; explanation: string }> {
  if (signal.aborted) throw new Error("انتهت مهلة المعالجة. يرجى المحاولة مجدداً.");

  let response: Response;
  try {
    response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        max_tokens: 1500,
        temperature: 0.4,
      }),
      signal,
    });
  } catch (err) {
    if (err instanceof Error && (err.name === "AbortError" || err.message === "aborted")) {
      throw new Error("انتهت مهلة الاتصال بـ Groq. يرجى المحاولة مجدداً.");
    }
    throw err;
  }

  if (response.status === 429) {
    if (attempt >= MAX_ATTEMPTS) {
      throw new Error("تجاوز الحد المسموح به من الطلبات. يرجى الانتظار دقيقة ثم المحاولة.");
    }
    const retryAfterHeader = response.headers.get("retry-after");
    let waitMs = 8_000;
    if (retryAfterHeader) {
      const secs = parseFloat(retryAfterHeader);
      if (!isNaN(secs)) waitMs = Math.min(Math.ceil(secs) * 1000 + 500, MAX_RETRY_SLEEP_MS);
    } else {
      try {
        const body = await response.json() as { error?: { message?: string } };
        const msg = body?.error?.message ?? "";
        const match = /try again in ([\d.]+)s/i.exec(msg);
        if (match) waitMs = Math.min(Math.ceil(parseFloat(match[1])) * 1000 + 500, MAX_RETRY_SLEEP_MS);
      } catch { /* ignore */ }
    }
    await sleepAbortable(waitMs, signal);
    return callGroq(apiKey, text, signal, attempt + 1);
  }

  if (!response.ok) {
    let errBody = "";
    try { errBody = await response.text(); } catch { /* ignore */ }
    throw new Error(`خطأ من Groq (${response.status}): ${errBody.slice(0, 300)}`);
  }

  const data = await response.json() as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = data.choices?.[0]?.message?.content ?? "{}";

  let parsed: { language?: string; translation?: string | null; explanation?: string };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    parsed = { explanation: raw };
  }

  return {
    language: parsed.language ?? "unknown",
    translation: parsed.translation ?? null,
    explanation: parsed.explanation ?? "",
  };
}

router.post("/explain", async (req, res) => {
  const { text } = req.body as { text?: string };

  if (!text || text.trim().length === 0) {
    res.status(400).json({ error: "النص مطلوب" });
    return;
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "مفتاح Groq API غير مضبوط على السيرفر" });
    return;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TOTAL_TIMEOUT_MS);

  try {
    const result = await callGroq(apiKey, text, controller.signal);
    clearTimeout(timeoutId);
    res.json(result);
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const message = err instanceof Error ? err.message : "خطأ غير معروف";
    req.log.error({ err, message }, "Groq API call failed");
    res.status(502).json({ error: message });
  }
});

export default router;
