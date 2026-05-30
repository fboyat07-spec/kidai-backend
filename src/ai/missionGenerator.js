export function generateMission(skill = "addition") {
  const normalized = String(skill || "addition").trim().toLowerCase();

  return {
    mission: `Ameliorer ${normalized}`,
    tasks: ["lecon", "exercice", "quiz"],
    reward: "50XP"
  };
}
