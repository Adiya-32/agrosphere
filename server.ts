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
const groq = new Groq({ apiKey: apiKey || "MISSING" });

app.post("/api/chat", async (req, res) => {
  try {
    const { prompt, messages, context } = req.body;
    
    // Собираем текст пользователя
    let userText = prompt || (messages && messages[messages.length - 1]?.content) || "";

    // ВАЖНО: Добавляем данные о месте прямо в текст сообщения для ИИ
    if (context && context.location) {
      const { lat, lng } = context.location;
      const ndvi = context.layers?.ndvi || "неизвестно";
      
      // Мы буквально говорим ИИ: "Представь, что ты смотришь на эту точку"
      userText = `Контекст участка: Координаты lat: ${lat}, lng: ${lng}. Индекс NDVI (здоровье растений): ${ndvi}. 
      Вопрос пользователя: ${userText}`;
    }

    const completion = await groq.chat.completions.create({
      messages: [
        { 
          role: "system", 
          content: "Ты — AgroSphere AI, эксперт по спутниковому мониторингу полей. Ты видишь координаты и данные NDVI, которые присылает пользователь, и помогаешь их анализировать." 
        },
        { role: "user", content: String(userText) }
      ],
      model: "llama-3.3-70b-versatile",
    });

    res.json({ text: completion.choices[0]?.message?.content });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

const distPath = path.resolve(process.cwd(), "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

app.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`🚀 Server on ${PORT}`);
});
