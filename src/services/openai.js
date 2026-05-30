import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY || "";
const configuredModel = process.env.OPENAI_MODEL || "gpt-4o-mini";

const client = apiKey ? new OpenAI({ apiKey, timeout: 15000 }) : null;

export function isOpenAIReady() {
  return Boolean(client);
}

function tutorFallbackReply(message = "") {
  const hasQuestion = Boolean(message && message.trim());
  if (!hasQuestion) {
    return "Bonjour ! Pose-moi une question de maths, lecture ou sciences, et je t'aide pas a pas.";
  }
  return "Bonne question ! On va proceder etape par etape: 1) reformule le probleme, 2) fais une tentative, 3) je t'aide a corriger.";
}

const fallbackTutor = {
  reply: tutorFallbackReply(""),
  hints: [],
  escalation: false,
  source: "fallback",
  model: null
};

const fallbackExercise = (skillId, difficulty) => ({
  id: "",
  skillId,
  difficulty,
  prompt: "What is 3 + 4?",
  choices: ["6", "7", "8", "9"],
  answer: "7",
  meta: { source: "fallback" }
});

function modelCandidates() {
  const candidates = [configuredModel, "gpt-4o-mini", "gpt-4.1-mini"];
  return [...new Set(candidates.filter(Boolean))];
}

function extractTextFromResponse(response) {
  if (!response) return "";

  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  if (!Array.isArray(response.output)) return "";

  const chunks = [];
  for (const item of response.output) {
    if (!Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (typeof content?.text === "string" && content.text.trim()) {
        chunks.push(content.text.trim());
      }
    }
  }

  return chunks.join("\n").trim();
}

function extractJsonObject(text = "") {
  const raw = String(text || "").trim();
  if (!raw) return null;

  const withoutFence = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(withoutFence);
  } catch (err) {
    // Continue below with best-effort object extraction.
  }

  const first = withoutFence.indexOf("{");
  const last = withoutFence.lastIndexOf("}");
  if (first === -1 || last === -1 || first >= last) {
    return null;
  }

  try {
    return JSON.parse(withoutFence.slice(first, last + 1));
  } catch (err) {
    return null;
  }
}

async function callOpenAIWithFallback(buildRequest) {
  if (!client) {
    throw new Error("openai_not_configured");
  }

  let lastError = null;

  for (const model of modelCandidates()) {
    try {
      const response = await client.responses.create(buildRequest(model));
      return { response, model };
    } catch (err) {
      lastError = err;
      const message = err?.message || "unknown_error";
      console.warn(`OpenAI call failed for model ${model}: ${message}`);
    }
  }

  throw lastError || new Error("openai_call_failed");
}

export async function generateTutorReply({ message }) {
  const userMessage = String(message || "").trim();
  if (!userMessage) {
    return {
      ...fallbackTutor,
      reply: tutorFallbackReply("")
    };
  }

  if (!client) {
    return {
      ...fallbackTutor,
      reply: tutorFallbackReply(userMessage)
    };
  }

  try {
    const { response, model } = await callOpenAIWithFallback((candidateModel) => ({
      model: candidateModel,
      input: [
        {
          role: "system",
          content:
            "You are a friendly AI tutor for children ages 6-14. Reply in simple French, concise, encouraging, and safe."
        },
        {
          role: "user",
          content: userMessage
        }
      ],
      max_output_tokens: 220
    }));

    const reply = extractTextFromResponse(response);
    if (!reply) {
      return {
        ...fallbackTutor,
        reply: tutorFallbackReply(userMessage)
      };
    }

    return {
      reply,
      hints: [],
      escalation: false,
      source: "openai",
      model
    };
  } catch (err) {
    return {
      ...fallbackTutor,
      reply: tutorFallbackReply(userMessage)
    };
  }
}

export async function generateExercise({ skillId, difficulty }) {
  if (!client) {
    return fallbackExercise(skillId, difficulty);
  }

  try {
    const { response, model } = await callOpenAIWithFallback((candidateModel) => ({
      model: candidateModel,
      input: [
        {
          role: "system",
          content:
            "Create one short exercise for children. Return ONLY JSON: {\"prompt\":\"...\",\"choices\":[\"...\"],\"answer\":\"...\"}."
        },
        {
          role: "user",
          content: `Skill: ${skillId}. Difficulty: ${difficulty || 1}.`
        }
      ],
      max_output_tokens: 220
    }));

    const json = extractJsonObject(extractTextFromResponse(response));
    const choices = Array.isArray(json?.choices)
      ? json.choices.filter((choice) => typeof choice === "string").slice(0, 6)
      : [];

    if (!json || typeof json.prompt !== "string" || choices.length < 2 || !json.answer) {
      return fallbackExercise(skillId, difficulty);
    }

    return {
      id: "",
      skillId,
      difficulty,
      prompt: json.prompt,
      choices,
      answer: String(json.answer),
      meta: { source: "openai", model }
    };
  } catch (err) {
    return fallbackExercise(skillId, difficulty);
  }
}

const fallbackHomeworkAnalysis = {
  summary: "Analyse indisponible pour le moment. Réessaie avec une photo plus nette.",
  strengths: ["Bonne tentative"],
  mistakes: ["Vérifier l'énoncé et les unités"],
  nextSteps: ["Refaire l'exercice étape par étape"],
  source: "fallback",
  model: null
};

export async function scanHomeworkImage({ imageUrl, instruction = "" } = {}) {
  if (!imageUrl || typeof imageUrl !== "string") {
    return fallbackHomeworkAnalysis;
  }

  if (!client) {
    return fallbackHomeworkAnalysis;
  }

  try {
    const { response, model } = await callOpenAIWithFallback((candidateModel) => ({
      model: candidateModel,
      input: [
        {
          role: "system",
          content:
            "Tu es un tuteur pour enfants (6-14). Analyse la photo d'un devoir et retourne UNIQUEMENT un JSON valide avec: summary, strengths[], mistakes[], nextSteps[]. Réponse en français simple."
        },
        {
          role: "user",
          content: [
            { type: "input_text", text: instruction || "Analyse cet exercice et explique ce qui est correct et ce qui doit être corrigé." },
            { type: "input_image", image_url: imageUrl }
          ]
        }
      ],
      max_output_tokens: 320
    }));

    const parsed = extractJsonObject(extractTextFromResponse(response));
    if (!parsed || typeof parsed.summary !== "string") {
      return fallbackHomeworkAnalysis;
    }

    return {
      summary: parsed.summary,
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 5) : [],
      mistakes: Array.isArray(parsed.mistakes) ? parsed.mistakes.slice(0, 5) : [],
      nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps.slice(0, 5) : [],
      source: "openai",
      model
    };
  } catch (err) {
    return fallbackHomeworkAnalysis;
  }
}
