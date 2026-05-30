import { collectPrerequisites, getSkill } from "./knowledgeGraph.js";

export function detectGap(skillId, mastery = {}, threshold = 0.65) {
  if (!getSkill(skillId)) {
    return {
      targetSkill: skillId,
      blockers: [],
      missingSkills: [],
      readinessScore: 0
    };
  }

  const prerequisites = collectPrerequisites(skillId);
  const missingSkills = prerequisites.filter((prereq) => (mastery[prereq] ?? 0) < threshold);
  const blockers = missingSkills.slice(0, 3);
  const total = Math.max(prerequisites.length, 1);
  const ready = prerequisites.length - missingSkills.length;

  return {
    targetSkill: skillId,
    blockers,
    missingSkills,
    readinessScore: Number((ready / total).toFixed(2))
  };
}
