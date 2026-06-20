import { Router, type IRouter } from "express";

const router: IRouter = Router();

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

  const systemPrompt = `أنت مساعد أكاديمي متخصص. سيُرسَل إليك نص، وعليك تنفيذ المهام التالية:

1. حدّد لغة النص (عربية أم إنجليزية أم غيرهما).
2. إذا كانت اللغة إنجليزية:
   - قدّم ترجمة دقيقة وحرفية للنص إلى العربية.
   - قدّم شرحاً أكاديمياً مبسطاً للمحتوى باللغة العربية.
3. إذا كانت اللغة عربية أو غيرها:
   - قدّم شرحاً أكاديمياً مبسطاً للمحتوى باللغة العربية فقط (بدون ترجمة).

أجب دائماً بصيغة JSON صحيحة على النحو التالي:
{
  "language": "english" | "arabic" | "other",
  "translation": "الترجمة هنا (فقط إذا كانت اللغة إنجليزية، وإلا اتركها null)",
  "explanation": "الشرح الأكاديمي المبسط هنا"
}

لا تضف أي نص خارج كتلة JSON.`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
        max_tokens: 3000,
        temperature: 0.5,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      req.log.error({ status: response.status, body: errBody }, "Groq API error");
      res.status(502).json({ error: `خطأ من Groq (${response.status}): ${errBody.slice(0, 300)}` });
      return;
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

    res.json({
      language: parsed.language ?? "unknown",
      translation: parsed.translation ?? null,
      explanation: parsed.explanation ?? "",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ غير معروف";
    req.log.error({ err }, "Groq fetch error");
    res.status(500).json({ error: `فشل الاتصال بـ Groq: ${message}` });
  }
});

export default router;
