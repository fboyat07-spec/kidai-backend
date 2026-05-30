export function adjustDifficulty({
  successRate = 0.5,
  currentLevel = 1,
  errorStreak = 0,
  responseMs = 0,
  minLevel = 1,
  maxLevel = 5
} = {}) {
  let nextLevel = currentLevel;
  let reason = "maintain";

  if (successRate >= 0.85 && errorStreak === 0) {
    nextLevel += 1;
    reason = "high_success";
  } else if (successRate <= 0.45 || errorStreak >= 3) {
    nextLevel -= 1;
    reason = "struggle_detected";
  } else if (responseMs > 25000 && successRate < 0.65) {
    nextLevel -= 1;
    reason = "slow_and_unstable";
  }

  nextLevel = Math.max(minLevel, Math.min(maxLevel, nextLevel));

  return {
    currentLevel,
    nextLevel,
    reason
  };
}
