import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";

const router  = express.Router();
const upload  = multer({
  dest: "uploads/",
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB max
});

// ── OpenAI lazy init ─────────────────────────────────────────
let openai = null;

async function getOpenAI() {
  if (openai) return openai;
  if (!process.env.OPENAI_API_KEY) return null;
  const { default: OpenAI } = await import("openai");
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openai;
}

// Crée le dossier uploads s'il n'existe pas
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

router.post("/transcribe", upload.single("audio"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Fichier audio requis" });
  }

  const filePath = req.file.path;

  // Renomme avec extension correcte pour Whisper
  const ext = req.file.mimetype.includes("webm") ? ".webm"
    : req.file.mimetype.includes("mp4") ? ".mp4"
    : req.file.mimetype.includes("wav") ? ".wav"
    : ".m4a";

  const renamedPath = filePath + ext;
  fs.renameSync(filePath, renamedPath);

  const client = await getOpenAI();
  if (!client) {
    fs.unlink(renamedPath, () => {});
    return res.status(503).json({ error: "OpenAI non configuré — OPENAI_API_KEY manquante." });
  }

  try {
    const transcription = await client.audio.transcriptions.create({
      file:     fs.createReadStream(renamedPath),
      model:    "whisper-1",
      language: "fr",
      prompt:   "Contexte : conversation éducative en français avec un enfant. Mots fréquents : fois, multiplié, divisé, plus, moins, égal, table, résultat, calcul, nombre, chiffre.",
    });

    res.json({ text: transcription.text });

  } catch (error) {
    console.error("[WHISPER ERROR]", error.message);
    res.status(500).json({ error: "Erreur transcription", detail: error.message });

  } finally {
    fs.unlink(renamedPath, () => {});
  }
});

export default router;
