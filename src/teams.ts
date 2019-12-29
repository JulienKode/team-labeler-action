export function getTeamLabel(
  labelGlobs: Map<string, string[]>,
  author: string
): string[] {
  const labels: string[] = []
  for (const [label, authors] of labelGlobs.entries())
    if (authors.includes(author)) labels.push(label)
  return labels
}
