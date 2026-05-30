const localExercises = {
  "math.addition.1": [
    { prompt: "How much is 2 + 5?", choices: ["5", "6", "7", "8"], answer: "7" },
    { prompt: "How much is 4 + 6?", choices: ["9", "10", "11", "12"], answer: "10" }
  ],
  "math.multiplication.1": [
    { prompt: "How much is 3 x 7?", choices: ["18", "20", "21", "24"], answer: "21" },
    { prompt: "How much is 6 x 4?", choices: ["20", "22", "24", "26"], answer: "24" }
  ]
};

export function generateExercise(skillId = "math.addition.1", difficulty = 1) {
  const items = localExercises[skillId] || localExercises["math.addition.1"];
  const index = Math.floor(Math.random() * items.length);
  const item = items[index];

  return {
    id: "",
    skillId,
    difficulty,
    prompt: item.prompt,
    choices: item.choices,
    answer: item.answer,
    meta: { source: "local-engine" }
  };
}
