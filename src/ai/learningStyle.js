export function detectStyle(data = {}) {
  const visual = Number(data.visualInteractions || 0);
  const text = Number(data.textInteractions || 0);
  const story = Number(data.storyInteractions || 0);

  if (visual >= text && visual >= story) return "visual";
  if (story >= visual && story >= text) return "narrative";
  return "logical";
}
