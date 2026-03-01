import express from "express";
import path from "path";
import fs from "fs";
import Groq from "groq-sdk";
import cors from "cors";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 8080;

  // Настройка парсинга и CORS (чтобы фронтенд мог достучаться)
  app.use(cors());
  app.use(express.json());

  const apiKey = process.env.GROQ_API_KEY;
  const groq = new Groq({ apiKey: apiKey || "" });

  // --- ВОТ ЭТОТ БЛОК ОТВЕЧАЕТ ЗА ЧАТ (ОТКУДА) ---
  app.post("/api/chat", async (req, res) => {
    try {
      const { prompt, messages, context } = req.body;
      
      // Вытягиваем текст: либо из prompt, либо из последнего сообщения
      let userText = prompt || (messages && messages[messages.length - 1]?.content) || "";

      // Добавляем контекст координат, если он пришел с фронтенда
      if (context && context.location) {
        userText = `Координаты: ${context.location.lat}, ${context.location.lng}. Вопрос: ${userText}`;
      }

      if (!apiKey) {
        console.error("ОШИБКА: Нет ключа GROQ_API_KEY в переменных Railway");
        return res.status(500).json({ error: "API Key missing on server" });
      }

      const completion = await groq.chat.completions.create({
        messages: [{ role: "user", content: String(userText) }],
        model: "llama3-8b-8192",
      });

      const aiContent = completion.choices[0]?.message?.content || "ИИ прислал пустой ответ";

      // Отправляем ответ в поле 'text', как ждет твой фронтенд
      res.json({ text: aiContent });

    } catch (error: any) {
      console.error("ДЕТАЛЬНАЯ ОШИБКА GROQ:", error.message);
      res.status(500).json({ error: "Ошибка ИИ", details: error.message });
    }
  });
  // --- КОНЕЦ БЛОКА ЧАТА (ДОКУДА) ---

  // Раздача фронтенда (папка dist)
  const distPath = path.resolve(process.cwd(), "dist");
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`🚀 AI Server live on port ${PORT}`);
  });
}

startServer();
