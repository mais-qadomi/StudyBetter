const VISION_MODELS = [
  "meta-llama/llama-4-scout-17b-16e-instruct",
];

const MAX_ATTEMPTS = 3;
const MAX_RETRY_SLEEP_MS = 15_000;

const visionSystemPrompt = `You are a brilliant Arab university professor specialized in Computer Networks and Computer Science, with decades of teaching experience. Your explanations are legendary among students for being deep, clear, and intellectually engaging.

The user will send you content from lecture slides. This content may include:
- Extracted digital text
- Page images (which may contain scanned text, diagrams, charts, or handwritten notes)

## Your task
1. Read ALL visible text in the image carefully.
2. Describe any diagrams, charts, graphs, tables, or visual elements — explain what they show and why they matter.
3. Combine information from both the extracted text AND the image into one complete, coherent explanation.
4. If the extracted text is empty or minimal, rely entirely on the image.

## Language & Style
- Write exclusively in formal, eloquent Modern Standard Arabic (فصحى أكاديمية رفيعة).
- Every English scientific term must appear naturally embedded: Arabic translation followed by English in parentheses, like: خوارزمية الترتيب المستقر (Stable Sorting).
- NEVER drop the English term. NEVER isolate it without Arabic context.

## Formatting markers (mandatory)
- Section headings: [H] ... [/H]
- English terms inline: [EN] ... [/EN]
- Professor insight notes: [NOTE] ... [/NOTE]
- Exam-critical alerts: [PIN] ... [/PIN]
- Quick summary: [SUM] ... [/SUM]
- Real-world examples: [EX] ... [/EX]

## Critical Rules
- NEVER skip any information.
- If the image quality is too low to read confidently, say so explicitly in the explanation.
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

async function callGroqVisionWithModel(
  apiKey: string,
  text: string,
  images: string[],
  model: string,
  signal: AbortSignal,
  attempt = 1,
): Promise<{ language: string; translation: string | null; explanation: string; rateLimited?: boolean }> {
  if (signal.aborted) throw new Error("انتهت مهلة المعالجة. يرجى المحاولة مجدداً.");

  const content: unknown[] = [{ type: "text", text: text || "(هذه الصفحة لا تحتوي على نص رقمي — اعتمد على الصورة كلياً)" }];
  for (const img of images) {
    content.push({ type: "image_url", image_url: { url: img } });
  }

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
          { role: "system", content: visionSystemPrompt },
          { role: "user", content },
        ],
        max_completion_tokens: 3000,
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
    return callGroqVisionWithModel(apiKey, text, images, model, signal, attempt + 1);
  }

  if (!response.ok) {
    let errBody = "";
    try { errBody = await response.text(); } catch { /* ignore */ }
    throw new Error(`خطأ من Groq Vision (${response.status}): ${errBody.slice(0, 300)}`);
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

export async function callGroqVision(
  apiKey: string,
  text: string,
  images: string[],
  signal: AbortSignal,
): Promise<{ language: string; translation: string | null; explanation: string }> {
  for (const model of VISION_MODELS) {
    const result = await callGroqVisionWithModel(apiKey, text, images, model, signal);
    if (!result.rateLimited) return result;
  }
  throw new Error("تجاوز الحد المسموح به من الطلبات على نماذج الرؤية. يرجى الانتظار ثم المحاولة.");
}
