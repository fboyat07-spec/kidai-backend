const intervalsDays = [1, 2, 4, 7, 14, 30];

export function spacedReview({
  stabilityLevel = 0,
  lastReviewAt = Date.now(),
  isCorrect = true
} = {}) {
  const bounded = Math.max(0, Math.min(intervalsDays.length - 1, stabilityLevel));
  const nextLevel = isCorrect ? Math.min(bounded + 1, intervalsDays.length - 1) : Math.max(0, bounded - 1);
  const intervalDays = intervalsDays[nextLevel];
  const nextReviewAt = new Date(new Date(lastReviewAt).getTime() + intervalDays * 24 * 60 * 60 * 1000);

  return {
    stabilityLevel: nextLevel,
    intervalDays,
    nextReviewAt: nextReviewAt.toISOString()
  };
}
