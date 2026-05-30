export const knowledgeGraph = {
  "math.addition.1": {
    title: "Addition Basics",
    domain: "math",
    prerequisites: [],
    minAge: 6
  },
  "math.subtraction.1": {
    title: "Subtraction Basics",
    domain: "math",
    prerequisites: ["math.addition.1"],
    minAge: 6
  },
  "math.multiplication.1": {
    title: "Multiplication Basics",
    domain: "math",
    prerequisites: ["math.addition.1"],
    minAge: 7
  },
  "math.division.1": {
    title: "Division Basics",
    domain: "math",
    prerequisites: ["math.multiplication.1"],
    minAge: 8
  },
  "math.fractions.1": {
    title: "Fractions Basics",
    domain: "math",
    prerequisites: ["math.division.1"],
    minAge: 8
  },
  "reading.phonics.1": {
    title: "Phonics",
    domain: "reading",
    prerequisites: [],
    minAge: 6
  },
  "reading.comprehension.1": {
    title: "Reading Comprehension",
    domain: "reading",
    prerequisites: ["reading.phonics.1"],
    minAge: 7
  },
  "language.spelling.1": {
    title: "Spelling",
    domain: "language",
    prerequisites: ["reading.phonics.1"],
    minAge: 7
  },
  "logic.patterns.1": {
    title: "Pattern Reasoning",
    domain: "logic",
    prerequisites: [],
    minAge: 6
  }
};

export function getSkill(skillId) {
  return knowledgeGraph[skillId] || null;
}

export function listSkillsByDomain(domain) {
  return Object.entries(knowledgeGraph)
    .filter(([, value]) => value.domain === domain)
    .map(([id, value]) => ({ id, ...value }));
}

export function collectPrerequisites(skillId) {
  const visited = new Set();

  function walk(currentSkill) {
    const skill = knowledgeGraph[currentSkill];
    if (!skill) return;
    for (const prereq of skill.prerequisites || []) {
      if (visited.has(prereq)) continue;
      visited.add(prereq);
      walk(prereq);
    }
  }

  walk(skillId);
  return [...visited];
}
