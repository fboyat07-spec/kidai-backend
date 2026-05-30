// ============================================================
//  KidAI Learning — Schémas Gap Detection
//  backend/schemas/gapDetection.js
//
//  Utilisé par les 4 IA d'analyse (GPT-4o, Claude, Gemini, Mistral)
//  pour normaliser les entrées et sorties de détection de lacunes.
// ============================================================

// ─────────────────────────────────────────────────────────────
//  SCHÉMA : sessionData
//  Ce qu'on envoie aux 4 IA pour analyse
// ─────────────────────────────────────────────────────────────

/**
 * @typedef {Object} QuestionResult
 * @property {string}  questionId      - Identifiant unique de la question
 * @property {string}  questionText    - Texte de la question posée
 * @property {boolean} correct         - Réponse correcte ou non
 * @property {number}  score           - Score obtenu (0.0 à 1.0)
 * @property {number}  timeSpentSec    - Temps passé sur la question (secondes)
 * @property {string}  errorType       - Type d'erreur : "calcul" | "compréhension" | "mémorisation" | "lecture" | null
 * @property {string}  [userAnswer]    - Réponse fournie par l'enfant
 * @property {string}  [correctAnswer] - Réponse attendue
 */

/**
 * @typedef {Object} SessionData
 * @property {string}           childId     - Identifiant Firebase de l'enfant
 * @property {number}           age         - Âge de l'enfant (6-14)
 * @property {string}           grade       - Niveau scolaire (CP, CE1, CE2, CM1, CM2, 6e…)
 * @property {string}           subject     - Matière : "Maths" | "Français" | "Sciences" | "Histoire"
 * @property {string}           topic       - Sujet spécifique (ex: "tables de multiplication")
 * @property {string}           sessionId   - Identifiant de session
 * @property {QuestionResult[]} questions   - Liste des questions et résultats
 * @property {number}           totalScore  - Score global de la session (0.0 à 1.0)
 * @property {number}           durationSec - Durée totale de la session
 */

export const sessionDataSchema = {
  childId:     { type: "string",   required: true },
  age:         { type: "number",   required: true,  min: 4, max: 18 },
  grade:       { type: "string",   required: true },
  subject:     { type: "string",   required: true },
  topic:       { type: "string",   required: true },
  sessionId:   { type: "string",   required: true },
  questions:   { type: "array",    required: true },
  totalScore:  { type: "number",   required: false, min: 0, max: 1 },
  durationSec: { type: "number",   required: false },
};


// ─────────────────────────────────────────────────────────────
//  SCHÉMA : GapResult
//  Ce que parseGaps() retourne pour chaque IA
// ─────────────────────────────────────────────────────────────

/**
 * @typedef {"comprehension"|"memorization"|"calcul"|"lecture"|"logique"|"vocabulaire"|"unknown"} GapType
 * @typedef {"low"|"medium"|"high"} Severity
 *
 * @typedef {Object} GapResult
 * @property {GapType}  gapType    - Nature de la lacune détectée
 * @property {string}   rootCause  - Explication de la cause racine (phrase courte normalisée)
 * @property {number}   confidence - Score de confiance de l'IA (0.0 à 1.0)
 * @property {string}   subject    - Matière concernée
 * @property {Severity} severity   - Gravité : "low" | "medium" | "high"
 * @property {string}   [recommendation] - Action corrective suggérée par l'IA
 */

const VALID_GAP_TYPES  = ["comprehension", "memorization", "calcul", "lecture", "logique", "vocabulaire", "unknown"];
const VALID_SEVERITIES = ["low", "medium", "high"];

/** GapResult vide retourné en cas d'échec de parsing */
export const EMPTY_GAP_RESULT = {
  gapType:    "unknown",
  rootCause:  "",
  confidence: 0,
  subject:    "",
  severity:   "low",
};


// ─────────────────────────────────────────────────────────────
//  parseGaps(rawText) — Extrait un GapResult depuis texte brut IA
// ─────────────────────────────────────────────────────────────

/**
 * Extrait un GapResult depuis le texte brut renvoyé par une IA.
 * Robuste : ne crashe jamais, retourne EMPTY_GAP_RESULT si le
 * JSON est absent, mal formé ou incomplet.
 *
 * @param  {string} rawText - Réponse brute de l'IA
 * @returns {GapResult}
 */
export function parseGaps(rawText) {
  if (!rawText || typeof rawText !== "string") {
    return { ...EMPTY_GAP_RESULT };
  }

  let parsed = null;

  // Tentative 1 : JSON pur
  try {
    parsed = JSON.parse(rawText.trim());
  } catch {
    // Tentative 2 : extraire le premier bloc JSON dans le texte
    const jsonMatch = rawText.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        // Tentative 3 : extraction ligne par ligne des champs clés
        parsed = extractFieldsFromText(rawText);
      }
    } else {
      parsed = extractFieldsFromText(rawText);
    }
  }

  if (!parsed || typeof parsed !== "object") {
    return { ...EMPTY_GAP_RESULT };
  }

  // Normalisation et validation des champs
  const gapType   = VALID_GAP_TYPES.includes(parsed.gapType)   ? parsed.gapType   : "unknown";
  const severity  = VALID_SEVERITIES.includes(parsed.severity) ? parsed.severity  : "low";
  const confidence = typeof parsed.confidence === "number"
    ? Math.min(1, Math.max(0, parsed.confidence))
    : parseFloat(parsed.confidence) || 0;

  return {
    gapType,
    rootCause:      typeof parsed.rootCause === "string" ? parsed.rootCause.trim()  : "",
    confidence,
    subject:        typeof parsed.subject   === "string" ? parsed.subject.trim()    : "",
    severity,
    recommendation: typeof parsed.recommendation === "string" ? parsed.recommendation.trim() : undefined,
  };
}

/**
 * Extraction heuristique des champs quand le JSON est absent.
 * Cherche des patterns "clé: valeur" dans le texte libre.
 * @param {string} text
 * @returns {Object}
 */
function extractFieldsFromText(text) {
  const result = {};
  const patterns = {
    gapType:        /gap[_\s]?type\s*[:=]\s*["']?(\w+)["']?/i,
    rootCause:      /root[_\s]?cause\s*[:=]\s*["']?([^"'\n]+)["']?/i,
    confidence:     /confidence\s*[:=]\s*["']?([\d.]+)["']?/i,
    subject:        /subject\s*[:=]\s*["']?([^"'\n]+)["']?/i,
    severity:       /severity\s*[:=]\s*["']?(\w+)["']?/i,
    recommendation: /recommendation\s*[:=]\s*["']?([^"'\n]+)["']?/i,
  };

  for (const [key, regex] of Object.entries(patterns)) {
    const match = text.match(regex);
    if (match) result[key] = match[1].trim();
  }

  if (result.confidence) result.confidence = parseFloat(result.confidence);
  return result;
}


// ─────────────────────────────────────────────────────────────
//  computeConsensus(results[]) — Consensus entre les 4 IA
// ─────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ConsensusGap
 * @property {string}   rootCause        - Cause racine normalisée
 * @property {GapType}  gapType          - Type de lacune majoritaire
 * @property {Severity} severity         - Sévérité la plus haute parmi les IA d'accord
 * @property {number}   globalConfidence - Confiance globale (nb IA d'accord / total IA)
 * @property {"HIGH"|"MEDIUM"|"LOW"} consensusLevel - Niveau de consensus
 * @property {number}   agreementCount   - Nombre d'IA en accord
 * @property {string[]} [recommendations] - Recommandations agrégées
 */

/**
 * Calcule le consensus entre les résultats de plusieurs IA.
 *
 * @param  {GapResult[]} results - Tableau des GapResult (1 par IA)
 * @returns {ConsensusGap[]} Gaps triés par severity décroissante
 */
export function computeConsensus(results) {
  if (!Array.isArray(results) || results.length === 0) return [];

  const totalAI = results.length;

  // Regroupement des gaps par rootCause similaire
  const groups = new Map(); // clé normalisée → { results[], gapType, severity }

  for (const result of results) {
    if (!result || !result.rootCause) continue;

    const key = normalizeRootCause(result.rootCause);
    if (!key) continue;

    if (!groups.has(key)) {
      groups.set(key, {
        rootCause:       result.rootCause,
        normalizedKey:   key,
        matches:         [],
        gapTypes:        {},
        severities:      [],
        recommendations: [],
      });
    }

    const group = groups.get(key);
    group.matches.push(result);

    // Comptage des gapTypes majoritaires
    group.gapTypes[result.gapType] = (group.gapTypes[result.gapType] || 0) + 1;

    // Collecte des sévérités
    if (result.severity) group.severities.push(result.severity);

    // Collecte des recommandations uniques
    if (result.recommendation && !group.recommendations.includes(result.recommendation)) {
      group.recommendations.push(result.recommendation);
    }
  }

  // Calcul du consensus pour chaque groupe
  const consensusGaps = [];

  for (const [, group] of groups) {
    const agreementCount   = group.matches.length;
    const globalConfidence = agreementCount / totalAI;

    // Niveau de consensus
    let consensusLevel;
    if (agreementCount >= 3)     consensusLevel = "HIGH";
    else if (agreementCount >= 2) consensusLevel = "MEDIUM";
    else                          consensusLevel = "LOW";

    // gapType majoritaire
    const gapType = Object.entries(group.gapTypes)
      .sort((a, b) => b[1] - a[1])[0][0];

    // Sévérité la plus haute
    const severity = highestSeverity(group.severities);

    consensusGaps.push({
      rootCause:       group.rootCause,
      gapType,
      severity,
      globalConfidence: Math.round(globalConfidence * 100) / 100,
      consensusLevel,
      agreementCount,
      recommendations: group.recommendations.length > 0 ? group.recommendations : undefined,
    });
  }

  // Tri par severity décroissante (high > medium > low), puis consensus décroissant
  return consensusGaps.sort((a, b) => {
    const severityOrder = { high: 3, medium: 2, low: 1 };
    const diff = (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
    if (diff !== 0) return diff;
    return b.agreementCount - a.agreementCount;
  });
}


// ─────────────────────────────────────────────────────────────
//  Helpers internes
// ─────────────────────────────────────────────────────────────

/**
 * Normalise une rootCause pour regrouper les formulations similaires.
 * Passe en minuscules, retire la ponctuation, tronque à 40 chars.
 * @param {string} text
 * @returns {string}
 */
function normalizeRootCause(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .toLowerCase()
    .replace(/[^a-zàâäéèêëîïôùûüç\s]/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 40);
}

/**
 * Retourne la sévérité la plus haute parmi une liste.
 * @param {string[]} severities
 * @returns {Severity}
 */
function highestSeverity(severities) {
  if (severities.includes("high"))   return "high";
  if (severities.includes("medium")) return "medium";
  return "low";
}
