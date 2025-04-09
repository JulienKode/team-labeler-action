export function getTeamLabel(
  labelsConfiguration: Map<string, string[]>,
  author: string
): string[] {
  const labels: string[] = []
  for (const [label, authors] of labelsConfiguration.entries()) {
    if (authors.some(a => a.toLowerCase() === author.toLowerCase()))
      labels.push(label)
  }
  return labels
}
