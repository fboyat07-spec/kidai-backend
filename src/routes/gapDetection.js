// ============================================================
//  KidAI Learning — Orchestrateur Gap Detection (3 IA cloud en parallèle)
//  POST /api/gaps/analyze
//
//  IA utilisées :
//    1. GPT-4o          — OpenAI SDK
//    2. Claude Sonnet 4 — Anthropic API (fetch)
//    3. Phi-3           — Ollama local (fetch, localhost:11434)
//    4. Gemini 1.5      — Google AI API (fetch)
//
//  Timeout par IA : 8 secondes
//  Consensus      : computeConsensus() depuis schemas/gapDetection.js
// ============================================================

import express        from "express";
import fetch          from "node-fetch";
import { parseGaps, computeConsensus } from "../schemas/gapDetection.js";
import {
  PROMPT_GPT4,
  PROMPT_CLAUDE,
  PROMPT_PHI3,
  PROMPT_GEMINI,
} from "../prompts/gapDetectionPrompts.js";

const router = express.Router();

// ── OpenAI lazy init ─────────────────────────────────────────
let openai = null;

async function getOpenAI() {
  if (openai) return openai;
  if (!process.env.OPENAI_API_KEY) return null;
  const { default: OpenAI } = await import("openai");
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openai;
}

const TIMEOUT_MS          = 8000;
const OLLAMA_TIMEOUT_MS   = 30000;  // LLM local — réservé pour usage futur
const CLAUDE_MODEL        = "claude-sonnet-4-20250514";
const GEMINI_MODEL        = "gemini-2.0-flash-lite";
const OLLAMA_MODEL        = "tinyllama";  // désactivé (CPU trop lent) — réactiver si GPU dispo
const OLLAMA_BASE_URL     = process.env.OLLAMA_URL || "http://localhost:11434";
const GEMINI_BASE_URL     = "https://generativelanguage.googleapis.com/v1beta/models";


// ─────────────────────────────────────────────────────────────
//  Données de session → bloc texte injecté dans chaque prompt
// ─────────────────────────────────────────────────────────────

function buildSessionContext(sessionData) {
  const { age, grade, subject, topic, questions = [], totalScore } = sessionData;

  const questionsSummary = questions.map((q, i) =>
    `Q${i + 1}: "${q.questionText || "?"}" | correct=${q.correct} | score=${q.score ?? "?"} | time=${q.timeSpentSec ?? "?"}s | errorType=${q.errorType || "none"}`
  ).join("\n");

  return `Enfant : ${age} ans, ${grade} | Matière : ${subject} | Sujet : "${topic}" | Score global : ${totalScore ?? "inconnu"}

Résultats détaillés :
${questionsSummary}`;
}

/**
 * Construit le message utilisateur complet pour une IA donnée.
 * Le system prompt est le rôle de l'IA ; le user message contient les données.
 */
function buildUserMessage(sessionData) {
  return `Voici les données de session à analyser :\n\n${buildSessionContext(sessionData)}`;
}


// ─────────────────────────────────────────────────────────────
//  Helper : timeout sur une Promise
// ─────────────────────────────────────────────────────────────

function withTimeout(promise, ms, label) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`[${label}] Timeout après ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}


// ─────────────────────────────────────────────────────────────
//  IA 1 : GPT-4o — OpenAI SDK
// ─────────────────────────────────────────────────────────────

async function callGPT4(userMessage) {
  const client = await getOpenAI();
  if (!client) throw new Error("OpenAI non configuré — OPENAI_API_KEY manquante.");
  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: PROMPT_GPT4 },
      { role: "user",   content: userMessage },
    ],
    temperature: 0.3,
    max_tokens: 300,
    response_format: { type: "json_object" },
  });
  return completion.choices[0]?.message?.content || "";
}


// ─────────────────────────────────────────────────────────────
//  IA 2 : Claude Sonnet 4 — Anthropic API (fetch)
// ─────────────────────────────────────────────────────────────

async function callClaude(userMessage) {
  // Skip si clé absente — évite une erreur 401 bloquante
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("[Claude] ANTHROPIC_API_KEY manquante — IA ignorée");
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:  "POST",
    headers: {
      "Content-Type":      "application/json",
      "x-api-key":         process.env.ANTHROPIC_API_KEY || "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model:      CLAUDE_MODEL,
      max_tokens: 300,
      system:     PROMPT_CLAUDE,
      messages:   [{ role: "user", content: userMessage }],
    }),
  });

  if (!res.ok) throw new Error(`[Claude] HTTP ${res.status}`);
  const data = await res.json();
  return data?.content?.[0]?.text || "";
}


// ─────────────────────────────────────────────────────────────
//  IA 3 : Phi-3 — Ollama local (localhost:11434)
// ─────────────────────────────────────────────────────────────

async function callPhi3(userMessage) {
  // Ollama n'a pas de system/user séparé — on concatène proprement
  const fullPrompt = `${PROMPT_PHI3}\n\n${userMessage}`;

  const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model:  OLLAMA_MODEL,
      prompt: fullPrompt,
      stream: false,
      options: { temperature: 0.3, num_predict: 300 },
    }),
  });

  if (!res.ok) throw new Error(`[Phi-3] HTTP ${res.status}`);
  const data = await res.json();
  return data?.response || "";
}


// ─────────────────────────────────────────────────────────────
//  IA 4 : Gemini 1.5 Flash — Google AI API (fetch)
// ─────────────────────────────────────────────────────────────

async function callGemini(userMessage) {
  const apiKey = process.env.GEMINI_API_KEY || "";
  const url = `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  // Gemini supporte systemInstruction depuis l'API v1beta
  const res = await fetch(url, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: PROMPT_GEMINI }] },
      contents: [{ parts: [{ text: userMessage }] }],
      generationConfig: {
        temperature:     0.3,
        maxOutputTokens: 300,
      },
    }),
  });

  if (!res.ok) throw new Error(`[Gemini] HTTP ${res.status}`);
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}


// ─────────────────────────────────────────────────────────────
//  Orchestrateur principal : 3 IA cloud en parallèle (GPT-4o, Claude, Gemini)
// ─────────────────────────────────────────────────────────────

async function orchestrateGapDetection(sessionData) {
  const userMessage = buildUserMessage(sessionData);

  const aiCalls = [
    { label: "gpt4",   fn: () => callGPT4(userMessage),   timeout: TIMEOUT_MS },
    { label: "claude", fn: () => callClaude(userMessage),  timeout: TIMEOUT_MS },
    { label: "gemini", fn: () => callGemini(userMessage),  timeout: TIMEOUT_MS },
    // tinyllama désactivé — CPU trop lent ; réactiver avec : { label: "tinyllama", fn: () => callPhi3(userMessage), timeout: OLLAMA_TIMEOUT_MS }
  ];

  // Lance les 3 IA cloud en parallèle — timeout individuel par IA
  const settled = await Promise.allSettled(
    aiCalls.map(({ fn, label, timeout }) => withTimeout(fn(), timeout, label))
  );

  // Log + parsing des résultats
  const gapResults = [];
  const aiStatus   = {};

  settled.forEach((result, i) => {
    const label = aiCalls[i].label;

    if (result.status === "fulfilled") {
      const rawText  = result.value;
      const gapResult = parseGaps(rawText);
      aiStatus[label] = { status: "ok", confidence: gapResult.confidence };
      if (gapResult.rootCause) gapResults.push(gapResult);  // ignore résultats vides
    } else {
      console.warn(`[GAP][${label}] Échec:`, result.reason?.message);
      aiStatus[label] = { status: "error", error: result.reason?.message };
    }
  });

  // Calcul du consensus
  const consensus = computeConsensus(gapResults);

  return {
    consensus,
    aiStatus,
    rawCount:  gapResults.length,
    totalAI:   aiCalls.length,
  };
}


// ─────────────────────────────────────────────────────────────
//  POST /api/gaps/analyze
// ─────────────────────────────────────────────────────────────

router.post("/analyze", async (req, res) => {
  const sessionData = req.body;

  // Validation minimale
  if (!sessionData?.childId || !sessionData?.subject || !sessionData?.questions) {
    return res.status(400).json({
      error: "Champs requis manquants : childId, subject, questions[]",
    });
  }

  console.log(`[GAP] Analyse démarrée — enfant ${sessionData.childId}, sujet ${sessionData.subject}`);

  try {
    const result = await orchestrateGapDetection(sessionData);

    console.log(`[GAP] Consensus calculé — ${result.rawCount}/${result.totalAI} IA ont répondu, ${result.consensus.length} gap(s) détecté(s)`);

    return res.json({
      success:   true,
      childId:   sessionData.childId,
      subject:   sessionData.subject,
      consensus: result.consensus,
      aiStatus:  result.aiStatus,
      meta: {
        rawCount:  result.rawCount,
        totalAI:   result.totalAI,
        analyzedAt: new Date().toISOString(),
      },
    });

  } catch (err) {
    console.error("[GAP] Erreur orchestrateur:", err.message);
    return res.status(500).json({
      error:   "Erreur lors de l'analyse des lacunes.",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});

export default router;
