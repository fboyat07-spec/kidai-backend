export function detectFrustration({
  errorStreak = 0,
  responseMs = 0,
  quitEvents = 0
} = {}) {
  let frustrationScore = 0;
  if (errorStreak >= 3) frustrationScore += 0.45;
  if (responseMs > 25000) frustrationScore += 0.25;
  if (quitEvents > 0) frustrationScore += 0.3;

  frustrationScore = Math.min(1, Number(frustrationScore.toFixed(2)));
  const engagementScore = Number((1 - frustrationScore).toFixed(2));

  let recommendedAction = "continue";
  if (frustrationScore >= 0.75) recommendedAction = "mini_lesson";
  else if (frustrationScore >= 0.45) recommendedAction = "visual_hint";

  return {
    frustrationScore,
    engagementScore,
    recommendedAction
  };
}
