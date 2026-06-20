import { Router, type IRouter } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";

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

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `أنت مساعد أكاديمي متخصص. المطلوب منك شرح النص التالي شرحاً أكاديمياً مبسطاً باللغة العربية، مع إبراز الأفكار الرئيسية والمفاهيم المهمة بشكل واضح ومنظم.

النص:
${text}

الشرح:`;

    const result = await model.generateContent(prompt);
    const explanation = result.response.text();

    res.json({ explanation });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ غير معروف";
    req.log.error({ err }, "Gemini API error");
    res.status(500).json({ error: `فشل الاتصال بـ Gemini: ${message}` });
  }
});

export default router;
