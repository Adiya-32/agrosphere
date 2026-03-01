import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Groq from "groq-sdk";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbDir = '/app/data';
if (!fs.existsSync(dbDir)){
    fs.mkdirSync(dbDir, { recursive: true });
}
const db = new Database('/app/data/agrosphere.db');
const JWT_SECRET = process.env.JWT_SECRET || "agro-sphere-secret-2026";
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || "",
});

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

  app.use(express.json());

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
    } catch (e) {
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

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }


app.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
}

startServer();
