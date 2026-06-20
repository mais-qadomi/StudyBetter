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
          {
            role: "system",
            content: "أنت مساعد أكاديمي متخصص. مهمتك شرح المحتوى شرحاً أكاديمياً مبسطاً باللغة العربية، مع إبراز الأفكار الرئيسية والمفاهيم المهمة بشكل واضح ومنظم.",
          },
          {
            role: "user",
            content: `اشرح النص التالي شرحاً أكاديمياً مبسطاً باللغة العربية:\n\n${text}`,
          },
        ],
        max_tokens: 2048,
        temperature: 0.7,
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
    const explanation = data.choices?.[0]?.message?.content ?? "";
    res.json({ explanation });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ غير معروف";
    req.log.error({ err }, "Groq fetch error");
    res.status(500).json({ error: `فشل الاتصال بـ Groq: ${message}` });
  }
});

export default router;
