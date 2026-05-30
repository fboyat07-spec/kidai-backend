const defaultProfile = {
  skills: {
    addition: 80,
    multiplication: 50,
    division: 20
  }
};

function normalizeProfile(profile) {
  if (!profile || typeof profile !== "object") return defaultProfile;
  const inputSkills = profile.skills && typeof profile.skills === "object" ? profile.skills : {};
  return {
    skills: {
      addition: Number(inputSkills.addition ?? 80),
      multiplication: Number(inputSkills.multiplication ?? 50),
      division: Number(inputSkills.division ?? 20)
    }
  };
}

export function getWeakSkills(profile = defaultProfile, threshold = 50) {
  const normalized = normalizeProfile(profile);
  return Object.entries(normalized.skills)
    .filter(([, score]) => Number(score) < Number(threshold))
    .map(([skill]) => skill);
}
