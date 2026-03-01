import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Groq from "groq-sdk";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. ПУТЬ К БАЗЕ ДАННЫХ: Используем './data' вместо '/app/data'
// Это критично для Railway, чтобы не было ошибки прав доступа
const dbDir = './data'; 
if (!fs.existsSync(dbDir)){
    fs.mkdirSync(dbDir, { recursive: true });
}
const db = new Database('./data/agrosphere.db');

const JWT_SECRET = process.env.JWT_SECRET || "agro-sphere-secret-2026";

// Таблицы БД
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    location TEXT,
    data TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

async function startServer() {
  const app = express();
  // Принудительно ставим 8080, чтобы не было путаницы с 3000
  const PORT = process.env.PORT || 8080; 

  const apiKey = process.env.GROQ_API_KEY;
  console.log("API Key check:", apiKey ? `Present (starts with ${apiKey.slice(0, 6)})` : "MISSING");

  const groq = new Groq({
    apiKey: apiKey || "",
  });

  app.use(express.json());

  // --- API ROUTES ---

  app.post("/api/auth/register", async (req, res) => {
    const { username, password } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const stmt = db.prepare("INSERT INTO users (username, password) VALUES (?, ?)");
      stmt.run(username, hashedPassword);
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: "Username already exists" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { username } = req.body;
    try {
      const demoUser = { id: 1, username: username || "Guest" };
      const token = jwt.sign(demoUser, JWT_SECRET);
      res.json({ 
        token, 
        username: demoUser.username,
        message: "Demo access granted" 
      });
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { messages } = req.body;
      const completion = await groq.chat.completions.create({
        messages,
        model: "mixtral-8x7b-32768",
      });
      res.json({ content: completion.choices[0].message.content });
    } catch (e: any) {
      // Выводим детальную ошибку от Groq в логи Railway
      console.error("GROQ API ERROR:", e.message || e);
      res.status(500).json({ error: "AI Service unavailable" });
    }
  });

  app.post("/api/sessions", (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
    
    try {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const { location, data } = req.body;
      const stmt = db.prepare("INSERT INTO sessions (user_id, location, data) VALUES (?, ?, ?)");
      stmt.run(decoded.id, location, JSON.stringify(data));
      res.json({ success: true });
    } catch (e) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  app.get("/api/sessions", (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
    
    try {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const sessions = db.prepare("SELECT * FROM sessions WHERE user_id = ? ORDER BY timestamp DESC LIMIT 5").all(decoded.id);
      res.json(sessions);
    } catch (e) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  
  const distPath = path.resolve(__dirname, "dist");

  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
    console.log("📁 Статика: папка dist найдена, раздаю фронтенд.");
  } else {
    console.log("⚠️ Статика: папка dist НЕ НАЙДЕНА. Проверь билд!");
    app.get("/", (req, res) => {
      res.send("Сервер работает, но папка /dist пуста. Проверь команду build в Railway.");
    });
  }

    
  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`🚀 Server is running on port ${PORT}`);
  });
}

startServer();
