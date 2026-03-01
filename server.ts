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
    const userText = req.body.prompt || "Привет";

    // ПРОВЕРКА КЛЮЧА
    if (!apiKey || apiKey === "MISSING") {
      return res.json({ text: "ОШИБКА: Ключ GROQ_API_KEY не установлен в Railway Variables!" });
    }

    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: String(userText) }],
      model: "llama-3.3-70b-versatile",
    });

    res.json({ text: completion.choices[0]?.message?.content || "ИИ промолчал" });

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
