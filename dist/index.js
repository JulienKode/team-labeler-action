Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const core = tslib_1.__importStar(require("@actions/core"));
const teams_js_1 = require("./teams.js");
const github_js_1 = require("./github.js");
async function run() {
    try {
        const token = core.getInput('repo-token', { required: true });
        const orgToken = core.getInput('org-token', { required: false });
        const configPath = core.getInput('configuration-path', { required: true });
        const teamsRepo = core.getInput('teams-repo', { required: false });
        const teamsBranch = core.getInput('teams-branch', { required: false });
        const prNumber = (0, github_js_1.getPrNumber)();
        if (!prNumber) {
            core.info('Could not get pull request number from context, exiting');
            return;
        }
        const author = (0, github_js_1.getPrAuthor)();
        if (!author) {
            core.info('Could not get pull request user from context, exiting');
            return;
        }
        const client = (0, github_js_1.createClient)(token);
        const orgClient = orgToken ? (0, github_js_1.createClient)(orgToken) : null;
        const labelsConfiguration = await (0, github_js_1.getLabelsConfiguration)(client, configPath, teamsRepo !== '' ? { repo: teamsRepo, ref: teamsBranch } : undefined);
        const userTeams = await (0, github_js_1.getUserTeams)(orgClient, author);
        const labels = (0, teams_js_1.getTeamLabel)(labelsConfiguration, `@${author}`);
        const teamLabels = userTeams
            .map(userTeam => (0, teams_js_1.getTeamLabel)(labelsConfiguration, userTeam))
            .flat();
        const allLabels = [...new Set([...labels, ...teamLabels])];
        if (allLabels.length > 0)
            await (0, github_js_1.addLabels)(client, prNumber, allLabels);
        core.setOutput('team_labels', JSON.stringify(allLabels));
    }
    catch (error) {
        if (error instanceof Error) {
            core.error(error);
            core.setFailed(error.message);
        }
    }
}
run();
//# sourceMappingURL=index.js.map
