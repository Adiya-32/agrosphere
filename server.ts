import express from "express";
import path from "path";
import fs from "fs";
import Groq from "groq-sdk";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Инициализация API ключа
const apiKey = process.env.GROQ_API_KEY;
const groq = new Groq({ apiKey: apiKey || "" });

app.post("/api/chat", async (req, res) => {
  try {
    // Вытаскиваем текст из запроса (поддерживаем оба формата)
    const userText = req.body.prompt || (req.body.messages && req.body.messages[0].content);

    if (!userText) {
      return res.status(400).json({ error: "Пустой запрос" });
    }

    if (!apiKey) {
      return res.status(500).json({ error: "Ключ GROQ_API_KEY не найден в Railway" });
    }

    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: String(userText) }],
      model: "llama3-8b-8192",
    });

    const aiReply = completion.choices[0]?.message?.content || "Нет ответа от ИИ";
    
    // Возвращаем именно поле 'text', как ждет твой фронтенд
    res.json({ text: aiReply });

  } catch (error: any) {
    console.error("ГРОК ОШИБКА:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Раздача готового фронтенда из папки dist
const distPath = path.resolve(process.cwd(), "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

app.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
