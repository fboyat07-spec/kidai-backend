const worldsByDomain = {
  math: "MathLand",
  reading: "GrammarWorld",
  logic: "LogicIsland",
  science: "SciencePlanet"
};

export function generateQuest(skillId = "math.addition.1", difficulty = 1) {
  const domain = String(skillId || "math.addition.1").split(".")[0] || "math";
  const world = worldsByDomain[domain] || "Academy";

  return {
    world,
    title: `Quest: Master ${skillId}`,
    objective: `Complete ${Math.max(2, difficulty + 1)} challenge(s) in ${world}`,
    rewardXp: 25 + difficulty * 10
  };
}
