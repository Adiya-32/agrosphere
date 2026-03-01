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
  const PORT = process.env.PORT || 3000;

  // 2. ИНИЦИАЛИЗАЦИЯ ИИ: Берем ключ прямо в момент старта сервера
  const apiKey = process.env.GROQ_API_KEY;
  
  // Этот лог в панели Railway покажет, видит ли сервер твой ключ
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
