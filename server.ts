import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const db = new Database("agrosphere.db");
const JWT_SECRET = process.env.JWT_SECRET || "agro-sphere-secret-2026";
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || "",
});

// Initialize DB
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
  const PORT = 3000;

  app.use(express.json());

  // Auth Routes
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
    const { username, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as any;
    if (user && await bcrypt.compare(password, user.password)) {
      const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
      res.json({ token, username: user.username });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  // AI Proxy (Groq)
  app.post("/api/ai/analyze", async (req, res) => {
    const { prompt, context } = req.body as {
      prompt?: string;
      context?: {
        location?: { lat: number; lng: number } | null;
        layer?: string;
        horizon?: string;
        uiLanguage?: "ru" | "en" | "kk";
      };
    };

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ error: "GROQ_API_KEY is not configured on the server" });
    }

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const loc = context?.location
      ? `${context.location.lat.toFixed(4)}, ${context.location.lng.toFixed(4)}`
      : "Global / Not specified";

    const layer = context?.layer ?? "ndvi";
    const horizon = context?.horizon ?? "present";
    const uiLanguage = context?.uiLanguage ?? "en";

    try {
      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: [
              "You are AgroSphere AI, a senior satellite data analyst and agronomist.",
              "Provide technical, data-driven advice for farmers and investors.",
              "If a location is provided, focus your analysis on that specific region's climate, soil, common crops, vegetation indices (NDVI, EVI), moisture, yield potential and degradation risk.",
              "",
              "Always answer in the SAME language as the user's question.",
              "If UI language is provided, you may slightly adapt tone/terminology to that locale, but do NOT switch to another language than the question.",
              "Use clean markdown for structure (headings, bullet points, tables when helpful).",
            ].join(" "),
          },
          {
            role: "user",
            content: [
              `User Question: ${prompt}`,
              "",
              "Current Context:",
              `- Location: ${loc}`,
              `- Analysis Layer: ${layer}`,
              `- Time Horizon: ${horizon}`,
              `- UI Language: ${uiLanguage}`,
            ].join("\n"),
          },
        ],
        temperature: 0.4,
        max_tokens: 1024,
      });

      const text =
        completion.choices?.[0]?.message?.content ??
        "Извини, модель Groq не вернула ответ.";

      res.json({ text });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "AI Analysis failed" });
    }
  });

  // Session Routes
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

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
