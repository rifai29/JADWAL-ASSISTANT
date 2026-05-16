import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || "",
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // API Routes
  app.post("/api/insights", async (req, res) => {
    const { items } = req.body;
    
    if (!items || items.length === 0) {
      return res.json({ insight: "Belum ada jadwal untuk dianalisis. Cobalah tambahkan beberapa kegiatan!" });
    }

    const prompt = `
      Saya memiliki jadwal kegiatan berikut:
      ${items.map((item: any) => `- ${item.title} pada ${item.date} pukul ${item.startTime}-${item.endTime} (Kategori: ${item.category}, Prioritas: ${item.priority})`).join('\n')}

      Berikan analisis singkat dan saran produktivitas (sekitar 2-3 kalimat) dalam Bahasa Indonesia. 
      Fokus pada efisiensi waktu dan keseimbangan antara pekerjaan dan istirahat.
    `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      res.json({ insight: response.text });
    } catch (error) {
      console.error("Gemini Error:", error);
      res.status(500).json({ error: "Gagal mendapatkan saran pintar." });
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
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
