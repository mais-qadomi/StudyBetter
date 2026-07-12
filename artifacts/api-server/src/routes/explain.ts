import { Router, type IRouter } from "express";
import { callGroqVision } from "../lib/vision";

const router: IRouter = Router();

const TOTAL_TIMEOUT_MS = 90_000;
const MAX_RETRY_SLEEP_MS = 20_000;
const MAX_ATTEMPTS = 5;

const systemPrompt = `You are a brilliant Arab university professor specialized in Computer Networks and Computer Science, with decades of teaching experience. Your explanations are legendary among students for being deep, clear, and intellectually engaging.

The user will send you text extracted from English lecture slides.

## Language & Style
- Write exclusively in formal, eloquent Modern Standard Arabic (فصحى أكاديمية رفيعة) — the kind found in top-tier Arab university textbooks and academic journals.
- Every English scientific term must appear naturally embedded within the Arabic sentence, written in English immediately after its Arabic translation in parentheses, like: خوارزمية الترتيب المستقر (Stable Sorting). NEVER drop the English term. NEVER isolate it without Arabic context.
- Your tone is that of a passionate, knowledgeable professor explaining face-to-face — precise, intellectually rich, and never condescending.
- NEVER output Chinese, Turkish, or any non-Arabic/English characters.
- The input text language does NOT matter — your response JSON structure is ALWAYS the same regardless of input language.
- Even if the input is Arabic, ALWAYS return valid JSON with explanation field filled.
## Depth & Quality
- Explain each concept deeply: what it is, how it works, why it exists, and what happens if it's absent.
- Connect concepts to each other causally — show the student the bigger picture.
- Examples must be concrete, realistic, and directly relevant to the concept (NOT generic or loosely related analogies).
- Never repeat the same idea in different words. Every sentence must add new value.
- Do NOT pad the explanation. Quality over quantity — but never sacrifice depth for brevity.

## Length
- Match length strictly to content complexity:
  - Simple/short content → 1-2 rich paragraphs. No headers. No summary.
  - Complex/long content → structured sections with headers, deep explanations, and a summary only if it adds value beyond what was already said.
- If content starts with a concept directly, do NOT write a separate introduction — merge them naturally into the first sentence.

## Formatting markers (mandatory — frontend renders these)
- CRITICAL: Every English term MUST be wrapped: [EN]Stable Sorting[/EN]. No exceptions — never write an English term without [EN][/EN] tags.
- Section headings: [H] ... [/H]
- English terms inline: [EN] ... [/EN]
- Professor insight notes: [NOTE] ... [/NOTE]
- Exam-critical alerts (ONE combined block only, never separate boxes): [PIN] ... [/PIN]
- Quick summary (only for long complex content): [SUM] ... [/SUM]
- Real-world examples: [EX] ... [/EX]

## Critical Rules
- NEVER skip any information from the original text.
- NEVER write a [PIN] block unless the concept is genuinely exam-critical.
- NEVER write a [SUM] block for short or simple content.
- If multiple exam points exist, combine them into ONE [PIN] block — never separate boxes.
- Respond ONLY in valid JSON:

{
  "language": "english",
  "translation": null,
  "explanation": "your full structured Arabic explanation here"
}`;
function sleepAbortable(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new Error("aborted")); return; }
    const tid = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => { clearTimeout(tid); reject(new Error("aborted")); }, { once: true });
  });
}

const MODELS = [
  "llama-3.3-70b-versatile",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "llama-3.1-8b-instant",
];

async function callGroqWithModel(
  apiKey: string,
  text: string,
  model: string,
  signal: AbortSignal,
  attempt = 1
): Promise<{ language: string; translation: string | null; explanation: string; rateLimited?: boolean }> {
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
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        max_tokens: 3000,
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
      return { language: "unknown", translation: null, explanation: "", rateLimited: true };
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
    return callGroqWithModel(apiKey, text, model, signal, attempt + 1);
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
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    const jsonMatch = /\{[\s\S]*\}/.exec(cleaned);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned) as typeof parsed;
  } catch {
    parsed = { explanation: raw };
  }

  return {
    language: parsed.language ?? "unknown",
    translation: parsed.translation ?? null,
    explanation: parsed.explanation ?? "",
  };
}

async function callGroq(
  apiKey: string,
  text: string,
  signal: AbortSignal,
): Promise<{ language: string; translation: string | null; explanation: string }> {
  for (const model of MODELS) {
    const result = await callGroqWithModel(apiKey, text, model, signal);
    if (!result.rateLimited) {
      return result;
    }
  }
  throw new Error("تجاوز الحد المسموح به من الطلبات على جميع النماذج. يرجى الانتظار ثم المحاولة.");
}

router.post("/explain", async (req, res) => {
  const { text, images } = req.body as { text?: string; images?: string[] };

  if ((!text || text.trim().length === 0) && (!images || images.length === 0)) {
    res.status(400).json({ error: "النص أو الصور مطلوبة" });
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
    let result: { language: string; translation: string | null; explanation: string };
    if (images && images.length > 0) {
      result = await callGroqVision(apiKey, text ?? "", images, controller.signal);
    } else {
      result = await callGroq(apiKey, text!, controller.signal);
    }
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
