export function interventionEngine({ errorStreak = 0, secondsIdle = 0 } = {}) {
  if (errorStreak >= 5) {
    return { action: "mini_lesson", urgency: "high" };
  }
  if (errorStreak >= 3 || secondsIdle >= 60) {
    return { action: "hint", urgency: "medium" };
  }
  return { action: "continue", urgency: "low" };
}
