import express from "express";
import fetch from "node-fetch";

const router = express.Router();

const LUMA_VOICE_ID = process.env.LUMA_VOICE_ID || "4DCtIjBPAAmizg9MemsD";

function getElevenLabsKey() {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) console.warn("[ElevenLabs] ELEVENLABS_API_KEY manquante");
  return key;
}

// POST /api/voice/tts
// Body : { text: "..." }
// Retourne : audio/mpeg en streaming
router.post("/tts", async (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: "text requis" });
  }

  const key = getElevenLabsKey();
  if (!key) return res.status(503).json({ error: "ElevenLabs non configuré" });

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${LUMA_VOICE_ID}/stream`,
      {
        method: "POST",
        headers: {
          "xi-api-key":   key,
          "Content-Type": "application/json",
          "Accept":       "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability:        0.5,
            similarity_boost: 0.8,
            style:            0.3,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error("[VOICE TTS ERROR]", err);
      return res.status(500).json({ error: "ElevenLabs error", detail: err });
    }

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Transfer-Encoding", "chunked");
    response.body.pipe(res);

  } catch (error) {
    console.error("[VOICE TTS ERROR]", error.message, error.stack);
    res.status(500).json({ error: "Erreur TTS" });
  }
});

export default router;
