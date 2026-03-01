import express from "express";
import path from "path";
import fs from "fs";
import Groq from "groq-sdk";
import cors from "cors";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 8080;

  // ОБЯЗАТЕЛЬНО: эти две строки позволяют серверу понимать запросы из чата
  app.use(cors());
  app.use(express.json());

  const apiKey = process.env.GROQ_API_KEY;
  const groq = new Groq({ apiKey: apiKey || "" });

  // РОУТ ДЛЯ ЧАТА (соответствует твоему фронтенду)
  app.post("/api/chat", async (req, res) => {
    try {
      const { prompt, messages } = req.body;
      const userText = prompt || (messages && messages[messages.length - 1].content);

      if (!apiKey) {
        return res.status(500).json({ error: "API Key missing on server" });
      }

      const completion = await groq.chat.completions.create({
        messages: [{ role: "user", content: userText }],
        model: "llama3-8b-8192",
      });

      // Возвращаем поле 'text', как того ждет твой AIAssistant.tsx
      res.json({ text: completion.choices[0].message.content });
    } catch (error: any) {
      console.error("Groq Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // РАЗДАЧА ФРОНТЕНДА
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
