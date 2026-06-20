import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.post("/explain", async (req, res) => {
  const { text } = req.body as { text?: string };

  if (!text || text.trim().length === 0) {
    res.status(400).json({ error: "النص مطلوب" });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "مفتاح Gemini API غير مضبوط على السيرفر" });
    return;
  }

  const prompt = `أنت مساعد أكاديمي متخصص. المطلوب منك شرح النص التالي شرحاً أكاديمياً مبسطاً باللغة العربية، مع إبراز الأفكار الرئيسية والمفاهيم المهمة بشكل واضح ومنظم.

النص:
${text}

الشرح:`;

  const models = ["gemini-2.0-flash-lite", "gemini-2.5-flash", "gemini-2.0-flash"];

  for (const model of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 2048 },
          }),
        }
      );

      if (response.status === 404) continue;

      if (!response.ok) {
        const errBody = await response.text();
        req.log.error({ status: response.status, body: errBody }, "Gemini API error");
        res.status(502).json({ error: `خطأ من Gemini (${response.status}): ${errBody.slice(0, 200)}` });
        return;
      }

      const data = await response.json() as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const explanation = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      res.json({ explanation, model });
      return;
    } catch (err: unknown) {
      req.log.error({ err, model }, "Fetch error");
    }
  }

  res.status(502).json({ error: "لا يوجد نموذج Gemini متاح لهذا المفتاح. تحقق من صلاحيات المفتاح في Google AI Studio." });
});

export default router;
