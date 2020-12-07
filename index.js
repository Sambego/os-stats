import dotenv from "dotenv";
import { Octokit } from "@octokit/rest";
import Table from "cli-table";
import chalk from "chalk";
import ora from "ora";

dotenv.config();

const since = `${new Date().getFullYear()}-01-01T00:00:00`;
const repos = [
    "auth0/angular-jwt",
    "auth0/angular-storage",
    "auth0/angular2-jwt",
    "auth0/identicons",
    "auth0/jwt-decode",
    "auth0/webauthn.me",
    "auth0/openidconnect-playground",
    "jsonwebtoken/jsonwebtoken.github.io",
    "samltool/samltool.github.io",
];

const octokit = new Octokit({ auth: process.env.GITHUB });
const statsTable = new Table({
    head: [
        chalk.white.bold("Repo"),
        chalk.white.bold("Commits"),
        chalk.white.bold("Open Issues"),
        chalk.white.bold("Closed Issues"),
        chalk.white.bold("Open Pull Requests"),
        chalk.white.bold("Closed Pull Requests"),
    ],
});

const getOwnerAndRepo = (repo) => ({
    owner: repo.split("/")[0],
    repo: repo.split("/")[1],
});

const getStatsForRepo = async(repository) => {
    const commits = await octokit.repos.getCommitActivityStats({
        ...getOwnerAndRepo(repository),
        since,
    });

    const allIssues = await octokit.issues.listForRepo({
        ...getOwnerAndRepo(repository),
        since,
        state: "all",
    });

    const issues = allIssues.data.filter((i) => {
        return !i.hasOwnProperty("pull_request");
    });

    const pulls = allIssues.data.filter((i) => {
        return i.hasOwnProperty("pull_request");
    });

    return {
        repository,
        commits: commits.data.length ?
            commits.data.reduce((total, current) => total + current.total, 0) :
            0,
        issues: {
            open: issues.filter((issues) => issues.state === "open").length,
            closed: issues.filter((issues) => issues.state === "closed").length,
            total: issues.length,
        },
        pulls: {
            open: pulls.filter((pulls) => pulls.state === "open").length,
            closed: pulls.filter((pulls) => pulls.state === "closed").length,
            total: pulls.length,
        },
    };
};

const fetchStats = async(repos) => {
    const totals = {
        commits: 0,
        issues: { open: 0, closed: 0 },
        pulls: { open: 0, closed: 0 },
    };

    const stats = await Promise.all(
        repos.map(async(repo) => {
            const spinner = ora(`Getting stats for ${chalk.green(repo)}\n`).start();
            const stats = await getStatsForRepo(repo);

            totals.commits += stats.commits;
            totals.issues.open += stats.issues.open;
            totals.issues.closed += stats.issues.closed;
            totals.pulls.open += stats.pulls.open;
            totals.pulls.closed += stats.pulls.closed;

            statsTable.push([
                chalk.white.bold(repo),
                stats.commits,
                stats.issues.open,
                stats.issues.closed,
                stats.pulls.open,
                stats.pulls.closed,
            ]);
            spinner.stop();
        })
    );

    statsTable.push([
        chalk.green("Total"),
        chalk.green(totals.commits),
        chalk.green(totals.issues.open),
        chalk.green(totals.issues.closed),
        chalk.green(totals.pulls.open),
        chalk.green(totals.pulls.closed),
    ]);

    return stats;
};

await fetchStats(repos);
console.log(statsTable.toString());