import {LabelConfig} from './github'
import {filterAtSign} from './teams'

export function getReviewersLabels(
  labelsConfiguration: Map<string, LabelConfig>,
  currentAssignedReviewers: string[],
  currentApprovedReviewers: string[],
  teamsMap: Map<string, string[]>
): string[] {
  const labels: string[] = []
  for (const [label, labelConfig] of labelsConfiguration.entries()) {
    if (labelConfig instanceof Array) {
      for (const currentReviewer of currentAssignedReviewers) {
        if (
          labelConfig.some(
            a => a.toLowerCase() === currentReviewer.toLowerCase()
          )
        ) {
          labels.push(label)
        }
      }
    } else {
      const approvedTeams = labelConfig.approved?.teams ?? []
      for (const team of approvedTeams) {
        const teamMembers = teamsMap.get(filterAtSign(team))
        for (const currentReviewer of currentApprovedReviewers) {
          if (
            teamMembers?.some(
              member => member.toLowerCase() === currentReviewer.toLowerCase()
            ) ||
            team.toLowerCase() === currentReviewer.toLowerCase()
          ) {
            labels.push(label)
          }
        }
      }
      const approvedUsers = labelConfig.approved?.users ?? []
      for (const user of approvedUsers) {
        for (const currentReviewer of currentApprovedReviewers) {
          if (user.toLowerCase() === currentReviewer.toLowerCase()) {
            labels.push(label)
          }
        }
      }
      const assignedTeam = labelConfig.assigned?.teams ?? []
      for (const team of assignedTeam) {
        const teamMembers = teamsMap.get(filterAtSign(team))
        for (const currentAssigned of currentAssignedReviewers) {
          if (
            teamMembers?.some(
              member => member.toLowerCase() === currentAssigned.toLowerCase()
            ) ||
            team.toLowerCase() === currentAssigned.toLowerCase()
          ) {
            labels.push(label)
          }
        }
      }
      const assignedUsers = labelConfig.assigned?.users ?? []
      for (const user of assignedUsers) {
        for (const currentAssigned of currentAssignedReviewers) {
          if (user.toLowerCase() === currentAssigned.toLowerCase()) {
            labels.push(label)
          }
        }
      }
    }
  }
  return [...new Set(labels)]
}
