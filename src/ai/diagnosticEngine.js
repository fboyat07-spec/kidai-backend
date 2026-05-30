const questionBank = {
  math: {
    1: [
      { id: "m1q1", prompt: "How much is 3 + 4?", choices: ["6", "7", "8", "9"], answer: "7" },
      { id: "m1q2", prompt: "How much is 9 - 5?", choices: ["3", "4", "5", "6"], answer: "4" }
    ],
    2: [
      { id: "m2q1", prompt: "How much is 6 x 3?", choices: ["16", "18", "21", "24"], answer: "18" },
      { id: "m2q2", prompt: "How much is 24 / 6?", choices: ["2", "3", "4", "6"], answer: "4" }
    ],
    3: [
      { id: "m3q1", prompt: "How much is 2/4 as decimal?", choices: ["0.25", "0.5", "0.75", "1"], answer: "0.5" },
      { id: "m3q2", prompt: "How much is 15% of 200?", choices: ["20", "25", "30", "35"], answer: "30" }
    ]
  },
  reading: {
    1: [
      { id: "r1q1", prompt: "Which word rhymes with cat?", choices: ["dog", "hat", "sun", "tree"], answer: "hat" },
      { id: "r1q2", prompt: "Pick the sentence ending mark: I am happy", choices: [".", "?", "!", ","], answer: "." }
    ],
    2: [
      { id: "r2q1", prompt: "Synonym of quick?", choices: ["slow", "fast", "heavy", "late"], answer: "fast" },
      { id: "r2q2", prompt: "Main idea means...", choices: ["small detail", "big message", "question", "name"], answer: "big message" }
    ],
    3: [
      { id: "r3q1", prompt: "Antonym of noisy?", choices: ["loud", "quiet", "bright", "new"], answer: "quiet" },
      { id: "r3q2", prompt: "Inference means...", choices: ["copy text", "guess using clues", "skip reading", "spell words"], answer: "guess using clues" }
    ]
  }
};

function pickFromLevel(domain, level, askedIds = []) {
  const items = questionBank[domain]?.[level] || [];
  return items.find((item) => !askedIds.includes(item.id)) || null;
}

export function diagnosticTest({ domain = "math", level = 1, askedIds = [] } = {}) {
  return pickFromLevel(domain, level, askedIds) || pickFromLevel(domain, 1, askedIds);
}

export function evaluateDiagnosticAnswer(question, answer) {
  const normalizedAnswer = String(answer ?? "").trim().toLowerCase();
  const normalizedCorrect = String(question?.answer ?? "").trim().toLowerCase();
  return normalizedAnswer === normalizedCorrect;
}

export function diagnosticPlacement({ total = 0, correct = 0 } = {}) {
  if (!total) return "beginner";
  const ratio = correct / total;
  if (ratio >= 0.8) return "advanced";
  if (ratio >= 0.55) return "intermediate";
  return "beginner";
}
