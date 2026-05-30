import "dotenv/config";
import express from "express";
import cors from "cors";
import tutorRoute   from "./routes/tutorRoute.js";
import voiceRoute   from "./routes/voiceRoute.js";
import whisperRoute from "./routes/whisperRoute.js";
import gapRoute     from "./routes/gapDetection.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use("/api/tutor",   tutorRoute);
app.use("/api/voice",   voiceRoute);
app.use("/api/whisper", whisperRoute);
app.use("/api/gaps",    gapRoute);

// 👉 REGISTER
app.post("/auth/register", (req, res) => {
  console.log("👤 REGISTER");

  res.json({
    userId: "user_" + Math.floor(Math.random() * 10000),
  });
});

// 👉 EXERCISE
app.get("/exercise", (req, res) => {
  const a = Math.floor(Math.random() * 10);
  const b = Math.floor(Math.random() * 10);

  res.json({
    question: `${a} + ${b}`,
    answer: a + b,
  });
});

// 👉 ANSWER
app.post("/answer", (req, res) => {
  const { userAnswer, correctAnswer } = req.body;

  const correct = Number(userAnswer) === Number(correctAnswer);

  res.json({
    correct,
    xp: correct ? 10 : 0,
  });
});

// 👉 SUMMARY
app.get("/summary", (req, res) => {
  res.json({
    xp: 0,
    streak: 0,
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
});
