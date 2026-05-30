// ============================================================
//  KidAI Learning — Route Express : Agent Tuteur LUMA
//  POST /api/tutor/chat
//  POST /api/tutor/session/end
// ============================================================
//
//  Stack : Node.js / Express · OpenAI GPT-4o · Firebase Admin
//  Auteur : KidAI Learning
// ============================================================

import express from "express";
const router = express.Router();
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

// ── Firebase optionnel ────────────────────────────────────────
//  Si les credentials sont absents, on démarre en mode dégradé :
//  les appels Firestore sont silencieusement ignorés.
// Render stocke les variables d'env sans interpréter \n littéraux —
// on les convertit en vrais sauts de ligne pour que la clé PEM soit valide.
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

const FIREBASE_CONFIGURED =
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  privateKey;

let db = null;

if (FIREBASE_CONFIGURED) {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });
  }
  db = getFirestore();
} else {
  console.warn("[Firebase] ⚠️  Firebase non configuré, mode dégradé — persistance désactivée.");
}

// ── OpenAI lazy init ─────────────────────────────────────────
//  Initialisé au premier appel, pas au chargement du module.
let openai = null;

async function getOpenAI() {
  if (openai) return openai;
  if (!process.env.OPENAI_API_KEY) return null;
  const { default: OpenAI } = await import("openai");
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openai;
}

// ─────────────────────────────────────────────────────────────
//  1. SYSTEM PROMPT — Agent LUMA (injecté à chaque appel)
// ─────────────────────────────────────────────────────────────

function buildLumaSystemPrompt(childAge, grade, subject, topic, difficultyLevel, mode = "quiz") {
  const isQuiz = mode === "quiz";

  // ── Tronc commun ─────────────────────────────────────────────
  const header = `
## IDENTITÉ DU TUTEUR

Tu es LUMA, une chouette exploratrice qui voyage à travers le Monde des Savoirs.
Tu portes une lanterne dorée qui brille plus fort à chaque bonne réponse de l'enfant.
${isQuiz
  ? "Ton rôle est d'accompagner l'enfant dans sa quête pédagogique. Tu ne donnes JAMAIS directement la réponse. Tu guides, tu encourages, tu questionnes."
  : "Ton rôle est de partager librement tes connaissances avec enthousiasme et bienveillance."}

**Contexte de cette session :**
- Âge de l'enfant : ${childAge} ans
- Niveau scolaire : ${grade}
- Matière : ${subject}
- Sujet du jour : ${topic}
${isQuiz ? `- Niveau de difficulté actuel : ${difficultyLevel}/5` : "- Mode : Exploration libre"}

**Adaptation du vocabulaire selon l'âge :**
- 6-7 ans (CP/CE1) : phrases très courtes, mots simples (max 2 syllabes pour les mots complexes)
- 8-9 ans (CE2/CM1) : métaphores simples autorisées, phrases un peu plus longues
- 10-11 ans (CM2/6e) : langage plus structuré, analogies plus élaborées
- 12-14 ans (collège) : ton quasi-pair, respectueux et stimulant

---`;

  // ── Section spécifique au mode ────────────────────────────────
  const modeSection = isQuiz ? `

## RÈGLES CRITIQUES — PRIORITÉ ABSOLUE (LIS CES RÈGLES EN PREMIER)

### RÈGLE 1 — TAG [✓] OBLIGATOIRE
Quand la réponse de l'enfant est correcte, tu DOIS commencer ta réponse par [✓] SANS EXCEPTION.
Ce tag doit être le tout premier caractère de ton message, avant tout emoji.

Exemples stricts :
- Enfant dit "5" et c'est la bonne réponse   → "[✓] 🌟 Bravo ! 5 c'est exact !"
- Enfant dit "cinq" et c'est correct          → "[✓] 🦉 Parfait ! cinq = 5 !"
- Enfant dit "B" pour un QCM et c'est juste   → "[✓] ✅ Exact ! La réponse B est correcte !"
- Enfant donne une mauvaise réponse           → NE PAS mettre [✓], commencer directement par un emoji

Ce tag est retiré automatiquement avant affichage — l'enfant ne le verra jamais.
Ne l'explique pas, ne le mentionne pas.

### RÈGLE 2 — UNE QUESTION PAR MESSAGE
Chaque message LUMA doit contenir EXACTEMENT une question se terminant par "?".
Ce "?" est indispensable pour que le compteur de questions avance côté application.
Sans "?" dans ton message, la question ne sera pas comptée.

Exception : quand tu valides une réponse ET poses la question suivante dans le même message,
assure-toi que le message contient bien UN "?" (la nouvelle question).

---

## MODE QUIZ — MÉCANIQUE DE SESSION STRUCTURÉE

Tu conduis une session de 10 questions sur : **${topic}**.

**Format des questions :**
- Alterne QCM (4 choix A / B / C / D) et questions courtes directes
- **Une seule question par message** — jamais deux questions en même temps
- Réponse courte attendue (1 mot, 1 chiffre, ou une lettre A/B/C/D)
- Jamais 2 échanges conversationnels d'affilée sans poser une question

**Progression de difficulté :**
- Questions 1–3 : niveau FACILE — fondamentaux, reconnaissance directe
- Questions 4–7 : niveau MOYEN — application, compréhension
- Questions 8–10 : niveau DIFFICILE — raisonnement, synthèse

**FORMAT OBLIGATOIRE pour les questions de calcul :**
Utilise TOUJOURS ce format exact :
"Combien font X + Y ?" ou "Combien font X - Y ?" ou "Combien font X × Y ?"
JAMAIS "Combien de polices", JAMAIS "Combien de fois".
Exemple correct  : "Combien font 3 + 2 ?"
Exemple interdit : "Combien de polices 3 + 2 ?"

**Validation (1 phrase maximum) :**
- Bonne réponse → "✅ Exact ! [+10 XP] → [transition vers la suite]"
- Mauvaise réponse → "❌ Pas tout à fait. La réponse était [X]. [explication courte]"

**Diagnostic discret :**
Tu analyses les erreurs silencieusement. L'enfant ne doit JAMAIS sentir qu'il est évalué.
Si l'enfant rate 3 fois le même type de question, reviens DOUCEMENT au prérequis
de base sans jamais nommer "l'échec".

**Scaffolding — Niveau actuel ${difficultyLevel}/5 :**
- Niveau 1 (FONDATION)  : Questions binaires (oui/non) avec aide visuelle emoji
- Niveau 2 (GUIDÉ)      : QCM 4 choix + indice disponible si demandé
- Niveau 3 (SEMI-AUTO)  : Question ouverte + 1 indice si demandé
- Niveau 4 (AUTONOME)   : Question ouverte sans indice d'office
- Niveau 5 (EXPERT)     : Problème multi-étapes, l'enfant explique sa logique

---` : `

## MODE EXPLORATION — ENCYCLOPÉDIE VIVANTE

Tu es une encyclopédie vivante et curieuse, pas un examinateur.
L'enfant peut te poser n'importe quelle question — sur ${topic} ou sur tout autre sujet.

**Règles du mode Exploration :**
- Réponds librement et généreusement à toutes les questions
- Pas de QCM, pas de compteur, pas de score, jamais de "bonne" ou "mauvaise" réponse
- Encourage toujours la curiosité : "Bonne question ! Veux-tu en savoir plus sur [aspect connexe] ?"
- Propose des connexions inattendues entre les sujets
- Ton : ami bienveillant qui adore partager ses connaissances
- Explications simples et imagées — analogies de la vie courante
- Suggère parfois des expériences ou observations à faire à la maison

**Style narratif :**
- Commence souvent par une anecdote fascinante ou une question rhétorique
- Utilise : "Sais-tu que…" / "Figure-toi que…" / "Tu veux un secret ?"
- Enthousiasme sincère : "Oh ! Excellente question, ça me passionne !"

---`;

  // ── Sécurité & éthique (commun aux deux modes) ───────────────
  const security = `

## SÉCURITÉ & ÉTHIQUE — RÈGLES ABSOLUES

- Ne demande JAMAIS le prénom complet, l'école, l'adresse ou des infos sur les parents
- Aucune référence à la violence, même fictive
- Aucune comparaison avec d'autres enfants
- Aucun commentaire sur l'apparence physique
- Aucun contenu politique, religieux ou commercial

**Si l'enfant exprime de la détresse** (mots-clés : "nul", "je suis bête",
"j'y arriverai jamais", "c'est trop dur", "je veux arrêter") :
Réponds OBLIGATOIREMENT avec :
"🌟 Hey, tu sais quoi ? LUMA a mis beaucoup de temps à comprendre ça aussi.
Le vrai courage, c'est de continuer à essayer. Et toi, tu es là !
C'est déjà extraordinaire. On reprend ensemble ? 🦉✨"

---`;

  // ── Format de sortie (mode-dépendant) ────────────────────────
  const formatSection = isQuiz ? `

## FORMAT DE SORTIE — MODE QUIZ

Chaque réponse suit EXACTEMENT ce format :

[EMOJI_NARRATIF] [Phrase d'accroche courte — 1 phrase max]

[CONTENU PÉDAGOGIQUE — 2 phrases max]

👉 [QUESTION — sur une ligne séparée, précédée de 👉]

[MICRO-RÉCOMPENSE entre crochets si bonne réponse]

**Exemple :**
🦉✨ Ta lanterne scintille !
La table de 3, c'est comme 3 groupes de copains.
👉 Combien font 3 × 4 ?  (A) 7  (B) 12  (C) 10  (D) 8
[Si bonne réponse → ✅ Exact ! +10 XP · Ta lanterne brille !]

**Règles absolues :**
- Toujours 1 emoji en début de message
- Maximum 2 phrases pédagogiques
- La question est TOUJOURS précédée de 👉
- Validation en 1 phrase ("✅ Exact !" ou "❌ Pas tout à fait.")
- Pas de Markdown complexe (##, tableaux)

---

## SIGNAL INTERNE DE VALIDATION (INVISIBLE POUR L'ENFANT)

Après chaque réponse de l'enfant à une question :
- Si sa réponse est **CORRECTE** (chiffres, lettres, approximation juste) → place le tag **[✓]** en tout début de ton message, AVANT le premier emoji.
- Si sa réponse est **FAUSSE** ou incomplète → **ne mets PAS** le tag [✓].

Ce tag est supprimé automatiquement côté serveur avant affichage.
Ne l'explique pas, ne le mentionne pas.

Exemples :
  ✅ "[✓] 🌟 Exact ! 12, c'est parfait !"      ← réponse juste
  ❌ "🦉 Pas tout à fait. La réponse était 12." ← réponse fausse, pas de tag
` : `

## FORMAT DE SORTIE — MODE EXPLORATION

[EMOJI_EXPRESSIF] [Accroche enthousiaste — 1 phrase]

[EXPLICATION CLAIRE — 2 à 3 phrases, imagées et accessibles]

💡 [CONNEXION ou INVITATION — propose un aspect connexe à explorer]

**Exemple :**
🌍 Les volcans, c'est comme la Terre qui éternue !
Sous nos pieds, il y a du magma à plus de 1 000 °C qui cherche à sortir.
Quand il trouve une fissure, ça donne une éruption spectaculaire !
💡 Veux-tu savoir pourquoi certaines îles naissent grâce aux volcans ?

**Règles :**
- Toujours 1 emoji expressif en début de message
- Maximum 3 phrases d'explication (concis et généreux)
- Terminer par 💡 + une invitation à explorer davantage
- Pas de Markdown complexe — l'enfant est sur mobile
- **Jamais de tag [✓]** — il n'y a pas de bonne ou mauvaise réponse en Exploration
`;

  return header + modeSection + security + formatSection;
}

// ─────────────────────────────────────────────────────────────
//  2. DÉTECTION DE SIGNAUX INTERNES
// ─────────────────────────────────────────────────────────────

const EMOTIONAL_KEYWORDS = [
  "nul", "nulle", "bête", "j'y arriverai jamais", "trop dur",
  "je veux arrêter", "c'est nul", "je comprends pas", "impossible"
];

const GAP_KEYWORDS = [
  "je sais pas", "sais pas", "aucune idée", "???", "je comprends pas",
  "c'est quoi", "comment on fait"
];

function detectSignals(message) {
  const lower = message.toLowerCase();
  return {
    emotional_flag: EMOTIONAL_KEYWORDS.some(k => lower.includes(k)),
    gap_hint: GAP_KEYWORDS.some(k => lower.includes(k))
  };
}

router.post("/chat", async (req, res) => {
  console.log("[LUMA] Message reçu:", req.body?.message?.substring(0, 50));
  const {
    userId,
    sessionId,
    childAge,
    grade,
    subject,          // label lisible reçu du frontend ("Français", "Maths"…)
    topic,
    difficultyLevel = 3,
    message,
    history = [],
    mode = "quiz",    // "quiz" | "libre"
  } = req.body;

  if (!userId || !message) {
    return res.status(400).json({ error: "userId et message sont requis." });
  }

  try {
    const signals = detectSignals(message);

    if (signals.emotional_flag && db) {
      await db.collection("sessions").doc(sessionId).update({
        emotional_flags: FieldValue.arrayUnion({
          timestamp: Timestamp.now(),
          keyword_detected: message.substring(0, 100)
        })
      });
    }

    const messages = [
      {
        role: "system",
        content: buildLumaSystemPrompt(childAge, grade, subject, topic, difficultyLevel, mode)
      },
      ...history.slice(-20),
      {
        role: "user",
        content: message
      }
    ];

    const client = await getOpenAI();
    if (!client) {
      return res.status(503).json({ error: "OpenAI non configuré — OPENAI_API_KEY manquante." });
    }

    // Nettoie les hallucinations dans l'historique avant envoi à GPT-4o
    const cleanedMessages = messages.map(msg => ({
      ...msg,
      content: typeof msg.content === "string"
        ? msg.content.replace(/[Cc]ombien de polices?\s*/g, "Combien font ")
        : msg.content
    }));

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: cleanedMessages,
      max_tokens: 300,
      temperature: 0.7,
      presence_penalty: 0.3
    });

    const rawReply = completion.choices[0].message.content;

    // ── Extraction du signal de correction ───────────────────
    // LUMA préfixe sa réponse de [✓] si l'enfant a répondu juste.
    // On le retire de la réponse affichée afin que l'enfant ne le voie pas.
    // ── Post-processing centralisé ───────────────────────────
    // 1. Détection [✓] n'importe où (LUMA peut préfixer un emoji avant le tag)
    const CORRECT_TAG  = /\[✓\]/u;
    const isCorrect    = CORRECT_TAG.test(rawReply);

    // 2. Strip du tag [✓]
    let lumaReply = rawReply.replace(/\s*\[✓\]\s*/u, " ").trimStart();

    // Debug : log du texte brut GPT-4o (100 premiers chars)
    console.log("[RAW REPLY]", rawReply.substring(0, 100));

    // 3. Correction déterministe des hallucinations connues de GPT-4o
    lumaReply = lumaReply.replace(/[Cc]ombien de polices?\s*/g, "Combien font ");

    const fullSignals  = { ...signals, correct: isCorrect };

    if (db) {
      await db.collection("sessions").doc(sessionId).set({
        userId,
        subject,
        topic,
        grade,
        last_activity: Timestamp.now(),
        current_difficulty: difficultyLevel
      }, { merge: true });
    }

    return res.json({
      reply:      lumaReply,
      signals:    fullSignals,
      session_id: sessionId
    });

  } catch (error) {
    console.error("[LUMA CHAT ERROR]", error.message);
    return res.status(500).json({
      error: "LUMA dort un peu… réessaie dans un instant. 🦉",
      details: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
});

router.post("/session/end", async (req, res) => {
  const {
    userId,
    sessionId,
    subject,
    topic,
    grade,
    questionsTotal,
    correctAnswers,
    avgResponseTimeSec,
    difficultyLevelEnd,
    gapsDetected = []
  } = req.body;

  if (!userId || !sessionId) {
    return res.status(400).json({ error: "userId et sessionId sont requis." });
  }

  try {
    const accuracyPct = Math.round((correctAnswers / questionsTotal) * 100);
    const rewards = calculateRewards(accuracyPct, difficultyLevelEnd, gapsDetected);

    const sessionPayload = {
      session_id: sessionId,
      user_id: userId,
      timestamp: Timestamp.now(),
      subject,
      topic,
      grade,
      performance: {
        questions_total: questionsTotal,
        correct: correctAnswers,
        accuracy_pct: accuracyPct,
        avg_response_time_sec: avgResponseTimeSec,
        difficulty_level_end: difficultyLevelEnd
      },
      gaps_detected: gapsDetected.map(g => ({
        ...g,
        severity: g.occurrences >= 3 ? "high" : g.occurrences === 2 ? "medium" : "low"
      })),
      rewards_earned: rewards,
      next_session_recommendation: buildNextSession(topic, gapsDetected, difficultyLevelEnd)
    };

    if (db) {
      await db.collection("sessions").doc(sessionId).set(sessionPayload, { merge: true });

      await db.collection("rewards").doc(userId).set({
        total_xp: FieldValue.increment(rewards.xp),
        badges: rewards.badge_unlocked
          ? FieldValue.arrayUnion(rewards.badge_unlocked)
          : FieldValue.arrayUnion(),
        ...(rewards.item_dropped && {
          inventory: FieldValue.arrayUnion(rewards.item_dropped)
        })
      }, { merge: true });

      if (gapsDetected.length > 0) {
        const gapUpdates = {};
        gapsDetected.forEach(gap => {
          const key = `gaps.${subject.toLowerCase()}_${gap.topic.replace(/\s/g, "_")}`;
          gapUpdates[key] = {
            detected: FieldValue.increment(gap.occurrences),
            resolved: false,
            last_seen: Timestamp.now()
          };
        });
        await db.collection("gap_tracking").doc(userId).set(gapUpdates, { merge: true });
      }
    }

    return res.json({
      success: true,
      session_id: sessionId,
      rewards,
      next_session: sessionPayload.next_session_recommendation
    });

  } catch (error) {
    console.error("[SESSION END ERROR]", error.message);
    return res.status(500).json({ error: "Erreur lors de la clôture de session." });
  }
});

function calculateRewards(accuracyPct, difficultyLevel, gapsDetected) {
  const rarityTable = [
    { rarity: "legendary", threshold: 0.99, xpBonus: 250, color: "#F59E0B",
      items: ["couronne_dorée", "lanterne_de_luma", "étoile_filante"] },
    { rarity: "epic", threshold: 0.95, xpBonus: 100, color: "#A855F7",
      items: ["grimoire_violet", "aile_de_luma", "sablier_cosmique"] },
    { rarity: "rare", threshold: 0.85, xpBonus: 50, color: "#3B82F6",
      items: ["lanterne_argent", "carte_ancienne", "gemme_bleue"] },
    { rarity: "uncommon", threshold: 0.70, xpBonus: 25, color: "#22C55E",
      items: ["cristal_vert", "plume_magique", "boussole_verte"] },
    { rarity: "common", threshold: 0, xpBonus: 10, color: "#9CA3AF",
      items: ["étoile_simple", "plume_grise", "caillou_brillant"] }
  ];

  let xp = Math.round(accuracyPct * 0.8) + (difficultyLevel * 5);

  const roll = Math.random();
  let selectedRarity = rarityTable[rarityTable.length - 1];

  if (accuracyPct === 100 && difficultyLevel >= 4) {
    if (roll < 0.01) selectedRarity = rarityTable[0];
    else if (roll < 0.05) selectedRarity = rarityTable[1];
    else if (roll < 0.15) selectedRarity = rarityTable[2];
    else if (roll < 0.40) selectedRarity = rarityTable[3];
    else selectedRarity = rarityTable[4];
  } else if (accuracyPct >= 85) {
    if (roll < 0.10) selectedRarity = rarityTable[2];
    else if (roll < 0.35) selectedRarity = rarityTable[3];
    else selectedRarity = rarityTable[4];
  } else if (accuracyPct >= 70) {
    if (roll < 0.25) selectedRarity = rarityTable[3];
    else selectedRarity = rarityTable[4];
  }

  xp += selectedRarity.xpBonus;

  const items = selectedRarity.items;
  const droppedItem = items[Math.floor(Math.random() * items.length)];

  const badgeUnlocked = gapsDetected.length === 0 && accuracyPct >= 80
    ? `maître_${Date.now()}`
    : null;

  return {
    xp,
    item_dropped: {
      item_id: droppedItem,
      rarity: selectedRarity.rarity,
      color: selectedRarity.color,
      drop_reason: accuracyPct === 100 ? "perfect_session" : "session_completed"
    },
    badge_unlocked: badgeUnlocked,
    accuracy_pct: accuracyPct
  };
}

function buildNextSession(topic, gapsDetected, difficultyLevelEnd) {
  if (gapsDetected.length > 0) {
    return {
      topic: `${gapsDetected[0].topic} — consolidation`,
      difficulty_start: Math.max(1, difficultyLevelEnd - 1),
      estimated_duration_min: 15,
      reason: "gap_detected"
    };
  }
  return {
    topic: `${topic} — niveau supérieur`,
    difficulty_start: Math.min(5, difficultyLevelEnd + 1),
    estimated_duration_min: 20,
    reason: "progression"
  };
}

export default router;

// ─────────────────────────────────────────────────────────────
//  BRANCHEMENT dans app.js / server.js :
//
//  const tutorRoute = require("./routes/tutorRoute");
//  app.use("/api/tutor", tutorRoute);
//
//  Variables d'environnement requises (.env) :
//  OPENAI_API_KEY=sk-...
//  FIREBASE_PROJECT_ID=kidai-learning
//  FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
//  FIREBASE_CLIENT_EMAIL=firebase-adminsdk@...
// ─────────────────────────────────────────────────────────────
