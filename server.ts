import express from "express";
import path from "path";
import fs from "fs";
import Groq from "groq-sdk";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

const apiKey = process.env.GROQ_API_KEY;
const groq = new Groq({ apiKey: apiKey || "" });

// --- НОВЫЙ БЛОК: РЕГИСТРАЦИЯ ---
app.post("/api/auth/register", (req, res) => {
  const { username, password } = req.body;
  console.log("Регистрация пользователя:", username);
  
  // Для MVP просто подтверждаем успех. 
  // В будущем тут будет запись в базу данных sqlite.
  res.status(201).json({ 
    message: "User created successfully",
    user: { id: "1", username: username } 
  });
});

app.post("/api/auth/login", (req, res) => {
  res.json({ token: "fake-jwt-token", user: { username: "user" } });
});
// ------------------------------

// --- ОБНОВЛЕННЫЙ ЧАТ (С КОНТЕКСТОМ) ---
app.post("/api/chat", async (req, res) => {
  try {
    const { prompt, messages, context } = req.body;
    let userText = prompt || (messages && messages[messages.length - 1]?.content) || "";

    // Инъекция данных с карты в запрос
    if (context && context.location) {
      const { lat, lng } = context.location;
      const ndvi = context.layers?.ndvi || "0.45 (норма)";
      userText = `[КОНТЕКСТ КАРТЫ: Lat ${lat}, Lng ${lng}, NDVI ${ndvi}] Пользователь спрашивает: ${userText}`;
    }

    if (!apiKey) return res.status(500).json({ error: "Ключ Groq не настроен" });

    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: "Ты - AgroSphere AI. Анализируй координаты и NDVI. Отвечай как агро-эксперт." },
        { role: "user", content: String(userText) }
      ],
      model: "llama-3.3-70b-versatile",
    });

    res.json({ text: completion.choices[0]?.message?.content });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Раздача фронтенда
const distPath = path.resolve(process.cwd(), "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (req, res) => res.sendFile(path.resolve(distPath, "index.html")));
}

app.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`🚀 Server on port ${PORT}`);
});
