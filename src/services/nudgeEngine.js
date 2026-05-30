export function buildSmartNudge({ summary, weeklyGoal = "", childName = "" } = {}) {
  const namePrefix = childName ? `${childName}, ` : "";
  const risk = summary?.dropRisk || "low";
  const streak = Number(summary?.streakDays || 0);
  const quizSuccess = Number(summary?.quizSuccessRate || 0);
  const lessonCompletions = Number(summary?.lessonCompletions || 0);
  const reminderGoal = String(weeklyGoal || "").replace(/_/g, " ");

  if (risk === "high") {
    return {
      type: "re_engagement",
      priority: "high",
      title: "Mini mission 3 minutes",
      message: `${namePrefix}on relance avec une mission ultra courte pour garder le rythme.`,
      action: { label: "Lancer mission", route: "Exercise" }
    };
  }

  if (quizSuccess > 0 && quizSuccess < 55) {
    return {
      type: "support_hint",
      priority: "medium",
      title: "Revision guidee",
      message: `${namePrefix}on revise les erreurs d'hier pour progresser plus vite.`,
      action: { label: "Mode revision", route: "Progress" }
    };
  }

  if (streak >= 5) {
    return {
      type: "streak_reward",
      priority: "medium",
      title: "Bonus de serie",
      message: `${namePrefix}super serie ${streak} jours, un bonus XP t'attend.`,
      action: { label: "Reclamer bonus", route: "Rewards" }
    };
  }

  if (lessonCompletions === 0) {
    return {
      type: "quick_win",
      priority: "medium",
      title: "Premier objectif du jour",
      message: `${namePrefix}fais une mission rapide maintenant pour debloquer ton XP.`,
      action: { label: "Commencer", route: "Missions" }
    };
  }

  return {
    type: "goal_followup",
    priority: "low",
    title: "Progression stable",
    message: reminderGoal
      ? `${namePrefix}objectif actif: ${reminderGoal}. Encore une mission aujourd'hui.`
      : `${namePrefix}continue comme ca avec une mission quotidienne.`,
    action: { label: "Voir progression", route: "Progress" }
  };
}
