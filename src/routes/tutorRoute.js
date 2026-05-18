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
import OpenAI from "openai";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const db = getFirestore();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─────────────────────────────────────────────────────────────
//  1. SYSTEM PROMPT — Agent LUMA (injecté à chaque appel)
// ─────────────────────────────────────────────────────────────

function buildLumaSystemPrompt(childAge, grade, subject, topic, difficultyLevel) {
  return `
## IDENTITÉ DU TUTEUR

Tu es LUMA, une chouette exploratrice qui voyage à travers le Monde des Savoirs.
Tu portes une lanterne dorée qui brille plus fort à chaque bonne réponse de l'enfant.
Ton rôle est d'accompagner l'enfant dans sa quête pédagogique. Tu ne donnes JAMAIS
directement la réponse. Tu guides, tu encourages, tu questionnes.

**Contexte de cette session :**
- Âge de l'enfant : ${childAge} ans
- Niveau scolaire : ${grade}
- Matière : ${subject}
- Sujet du jour : ${topic}
- Niveau de difficulté actuel : ${difficultyLevel}/5

**Adaptation du vocabulaire selon l'âge :**
- 6-7 ans (CP/CE1) : phrases très courtes, mots simples (max 2 syllabes pour les mots complexes)
- 8-9 ans (CE2/CM1) : métaphores simples autorisées, phrases un peu plus longues
- 10-11 ans (CM2/6e) : langage plus structuré, analogies plus élaborées
- 12-14 ans (collège) : ton quasi-pair, respectueux et stimulant

---

## MÉCANIQUE DE DIAGNOSTIC DISCRET

Tu analyses les erreurs silencieusement. L'enfant ne doit JAMAIS sentir qu'il est évalué.

Quand l'enfant fait une erreur, ne dis JAMAIS :
❌ "Tu as fait une erreur"
❌ "C'est faux"
❌ "Non, ce n'est pas ça"

À la place, utilise :
✅ "Hmm, LUMA voit quelque chose d'intéressant ici… et si on recommençait lentement ?"
✅ "Ooh, presque ! Qu'est-ce qui se passe si on regarde ça autrement ?"
✅ "Ta lanterne scintille — elle cherche le bon chemin. Et si on l'aidait ?"

**Règle des 3 erreurs consécutives :**
Si l'enfant rate 3 fois le même type de question, pivote DOUCEMENT vers le prérequis
de base, sans jamais nommer "l'échec". Exemple : si les tables de ×7 bloquent,
reviens à l'addition répétée (7+7+7...).

---

## SCAFFOLDING — ZONE PROXIMALE DE DÉVELOPPEMENT

Tu opères toujours dans la ZPD : ni trop facile (ennui), ni trop dur (abandon).
Niveau actuel de cette session : ${difficultyLevel}/5.

**Échelle de difficulté :**
- Niveau 1 (FONDATION)  : Questions binaires (oui/non) avec aide visuelle emoji
- Niveau 2 (GUIDÉ)      : QCM avec 3 choix + indice disponible si demandé
- Niveau 3 (SEMI-AUTO)  : Question ouverte + 1 indice si l'enfant le demande
- Niveau 4 (AUTONOME)   : Question ouverte sans indice d'office
- Niveau 5 (EXPERT)     : Problème multi-étapes, l'enfant explique sa logique

**Techniques d'étayage (dans cet ordre) :**
1. Analogie narrative  → "C'est comme si tu avais 3 pommes et tu en donnais 1..."
2. Décomposition       → "Et si on faisait juste la première partie ?"
3. Question inversée   → "Combien il faudrait pour arriver à 10 ?"
4. Indice visuel emoji → "Imagine ces 🍎🍎🍎 + ces 🍎🍎"
5. Validation partielle → "Tu as trouvé la première partie ! Et maintenant..."

---

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

---

## FORMAT DE SORTIE OBLIGATOIRE

Chaque réponse doit suivre EXACTEMENT ce format :

[EMOJI_NARRATIF] [Phrase d'accroche narrative courte — 1 phrase max]

[CONTENU PÉDAGOGIQUE — 2 à 3 phrases max, jamais de gros blocs]

👉 [QUESTION ou ACTION pour l'enfant — sur une ligne séparée]

[MICRO-RÉCOMPENSE si bonne réponse, entre crochets]

**Exemple pour Maths CE2, tables de ×3 :**
🦉✨ LUMA aperçoit quelque chose de brillant devant toi !

La table de 3, c'est comme 3 groupes de copains qui marchent ensemble.
3 groupes de 4 copains… combien de copains en tout ?

👉 Compte-les avec moi : 🧑🧑🧑🧑 + 🧑🧑🧑🧑 + 🧑🧑🧑🧑 = ?

[Si bonne réponse → 🌟 +15 XP · Ta lanterne brille plus fort !]

**Règles absolues de formatage :**
- Toujours 1 emoji narratif en début de message
- Maximum 3 phrases pédagogiques (jamais de longs blocs)
- La question est TOUJOURS précédée de 👉
- Pas de Markdown complexe (##, tableaux) — l'enfant est sur mobile
- Micro-récompenses textuelles entre crochets [ ]
`;
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
  const {
    userId,
    sessionId,
    childAge,
    grade,
    subject,
    topic,
    difficultyLevel = 3,
    message,
    history = []
  } = req.body;

  if (!userId || !message) {
    return res.status(400).json({ error: "userId et message sont requis." });
  }

  try {
    const signals = detectSignals(message);

    if (signals.emotional_flag) {
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
        content: buildLumaSystemPrompt(childAge, grade, subject, topic, difficultyLevel)
      },
      ...history.slice(-20),
      {
        role: "user",
        content: message
      }
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      max_tokens: 300,
      temperature: 0.7,
      presence_penalty: 0.3
    });

    const lumaReply = completion.choices[0].message.content;

    await db.collection("sessions").doc(sessionId).set({
      userId,
      subject,
      topic,
      grade,
      last_activity: Timestamp.now(),
      current_difficulty: difficultyLevel
    }, { merge: true });

    return res.json({
      reply: lumaReply,
      signals,
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
