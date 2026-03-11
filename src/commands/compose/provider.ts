import { Command } from "@oclif/core";
import axios from "axios";
import chalk from "chalk";
import inquirer from "inquirer";
import fs from "node:fs";

import { type Environment, getProject, getProjects } from "../../utils/shared.js";
import { type AuthConfig, readAuthConfig } from "../../utils/utils.js";

type SourceType = "bitbucket" | "git" | "gitea" | "github" | "gitlab" | "raw";

type GitProvider = {
	bitbucket: { bitbucketId: string } | null;
	gitea: { giteaId: string } | null;
	github: { githubId: string } | null;
	gitlab: { gitlabId: string } | null;
	name: string;
	providerType: string;
};

type Compose = {
	appName: string;
	composeId: string;
	name: string;
};

export default class ComposeProvider extends Command {
	static override description =
		"Configure the source provider for a compose service (GitHub, GitLab, Bitbucket, Gitea, custom Git, or raw file).";

	static override examples = ["<%= config.bin %> compose provider"];

	public async run(): Promise<void> {
		const auth = await readAuthConfig(this);

		this.log(chalk.blue.bold("\n  Listing all Projects \n"));
		const projects = await getProjects(auth, this);

		const { project } = await inquirer.prompt<{ project: { name: string; projectId: string } }>([
			{
				choices: projects.map((p) => ({ name: p.name, value: p })),
				message: "Select a project:",
				name: "project",
				type: "list",
			},
		]);

		const projectDetails = await getProject(project.projectId, auth, this);

		const { environment } = await inquirer.prompt<{ environment: Environment }>([
			{
				choices: projectDetails.environments.map((e: Environment) => ({
					name: e.name,
					value: e,
				})),
				message: "Select an environment:",
				name: "environment",
				type: "list",
			},
		]);

		const composes: Compose[] = environment.compose ?? [];

		if (composes.length === 0) {
			this.error(chalk.red("No compose services found in this environment."));
		}

		const { compose } = await inquirer.prompt<{ compose: Compose }>([
			{
				choices: composes.map((c) => ({
					name: `${c.appName}:${c.name}`,
					value: c,
				})),
				message: "Select a compose service to configure:",
				name: "compose",
				type: "list",
			},
		]);

		const { sourceType } = await inquirer.prompt<{ sourceType: SourceType }>([
			{
				choices: [
					{ name: "GitHub", value: "github" },
					{ name: "GitLab", value: "gitlab" },
					{ name: "Bitbucket", value: "bitbucket" },
					{ name: "Gitea", value: "gitea" },
					{ name: "Custom Git URL", value: "git" },
					{ name: "Raw compose file", value: "raw" },
				],
				message: "Select source type:",
				name: "sourceType",
				type: "list",
			},
		]);

		const payload = await this.buildPayload(auth, sourceType, compose.composeId);
		await this.updateCompose(auth, payload);

		this.log(chalk.green(`\n✓ Provider configured for compose service '${compose.name}'.`));
	}

	private async buildPayload(
		auth: AuthConfig,
		sourceType: SourceType,
		composeId: string,
	): Promise<Record<string, unknown>> {
		const base = { composeId, sourceType };

		switch (sourceType) {
			case "github": {
				const providers = await this.fetchProvidersByType(auth, "github");
				const { providerId } = await this.pickProvider(providers, "GitHub", (p) => p.github!.githubId);
				const fields = await this.promptGitFields();
				return { ...base, githubId: providerId, ...fields };
			}
			case "gitlab": {
				const providers = await this.fetchProvidersByType(auth, "gitlab");
				const { providerId } = await this.pickProvider(providers, "GitLab", (p) => p.gitlab!.gitlabId);
				const fields = await this.promptGitFields();
				const { gitlabPathNamespace, gitlabProjectId } = await inquirer.prompt<{
					gitlabPathNamespace: string;
					gitlabProjectId: number;
				}>([
					{
						message: "GitLab project ID (numeric):",
						name: "gitlabProjectId",
						type: "number",
					},
					{
						message: "GitLab path namespace (e.g. mygroup/myrepo):",
						name: "gitlabPathNamespace",
						type: "input",
						validate: (v: string) => (v.trim() ? true : "Required"),
					},
				]);
				return {
					...base,
					composePath: fields.composePath,
					gitlabBranch: fields.branch,
					gitlabId: providerId,
					gitlabOwner: fields.owner,
					gitlabPathNamespace,
					gitlabProjectId,
					gitlabRepository: fields.repository,
				};
			}

			case "bitbucket": {
				const providers = await this.fetchProvidersByType(auth, "bitbucket");
				const { providerId } = await this.pickProvider(providers, "Bitbucket", (p) => p.bitbucket!.bitbucketId);
				const fields = await this.promptGitFields();
				const { slug } = await inquirer.prompt<{ slug: string }>([
					{
						default: fields.repository,
						message: "Repository slug:",
						name: "slug",
						type: "input",
					},
				]);
				return {
					...base,
					bitbucketBranch: fields.branch,
					bitbucketId: providerId,
					bitbucketOwner: fields.owner,
					bitbucketRepository: fields.repository,
					bitbucketRepositorySlug: slug,
					composePath: fields.composePath,
				};
			}

			case "gitea": {
				const providers = await this.fetchProvidersByType(auth, "gitea");
				const { providerId } = await this.pickProvider(providers, "Gitea", (p) => p.gitea!.giteaId);
				const fields = await this.promptGitFields();
				return {
					...base,
					composePath: fields.composePath,
					giteaBranch: fields.branch,
					giteaId: providerId,
					giteaOwner: fields.owner,
					giteaRepository: fields.repository,
				};
			}

			case "git": {
				const { customGitUrl, customGitBranch, composePath } = await inquirer.prompt<{
					composePath: string;
					customGitBranch: string;
					customGitUrl: string;
				}>([
					{
						message: "Repository URL (HTTPS or SSH):",
						name: "customGitUrl",
						type: "input",
						validate: (v: string) => (v.trim() ? true : "Required"),
					},
					{
						default: "main",
						message: "Branch:",
						name: "customGitBranch",
						type: "input",
					},
					{
						default: "./docker-compose.yml",
						message: "Compose file path:",
						name: "composePath",
						type: "input",
					},
				]);
				return { ...base, composePath, customGitBranch, customGitUrl };
			}

			case "raw": {
				const { filePath } = await inquirer.prompt<{ filePath: string }>([
					{
						message: "Path to docker-compose file:",
						name: "filePath",
						type: "input",
						validate: (v: string) => {
							if (!v.trim()) return "Required";
							if (!fs.existsSync(v)) return `File not found: ${v}`;
							return true;
						},
					},
				]);
				const composeFile = fs.readFileSync(filePath, "utf8");
				return { ...base, composeFile };
			}
		}
	}

	private async fetchProvidersByType(auth: AuthConfig, type: string): Promise<GitProvider[]> {
		const response = await axios.get(`${auth.url}/api/trpc/gitProvider.getAll`, {
			headers: {
				"Content-Type": "application/json",
				"x-api-key": auth.token,
			},
		});
		const all: GitProvider[] = response.data.result.data.json ?? [];
		const filtered = all.filter((p) => p.providerType === type);
		if (filtered.length === 0) {
			this.error(chalk.red(`No ${type} providers found. Connect one first with: dokploy github connect`));
		}

		return filtered;
	}

	private async pickProvider(
		providers: GitProvider[],
		label: string,
		getId: (p: GitProvider) => string,
	): Promise<{ providerId: string }> {
		const { provider } = await inquirer.prompt<{ provider: GitProvider }>([
			{
				choices: providers.map((p) => ({ name: p.name, value: p })),
				message: `Select ${label} provider:`,
				name: "provider",
				type: "list",
			},
		]);
		return { providerId: getId(provider) };
	}

	private async promptGitFields(): Promise<{
		branch: string;
		composePath: string;
		owner: string;
		repository: string;
	}> {
		return inquirer.prompt([
			{
				message: "Repository owner (user or org):",
				name: "owner",
				type: "input",
				validate: (v: string) => (v.trim() ? true : "Required"),
			},
			{
				message: "Repository name:",
				name: "repository",
				type: "input",
				validate: (v: string) => (v.trim() ? true : "Required"),
			},
			{
				default: "main",
				message: "Branch:",
				name: "branch",
				type: "input",
			},
			{
				default: "./docker-compose.yml",
				message: "Compose file path:",
				name: "composePath",
				type: "input",
			},
		]);
	}

	private async updateCompose(auth: AuthConfig, payload: Record<string, unknown>): Promise<void> {
		const response = await axios.post(
			`${auth.url}/api/trpc/compose.update`,
			{ json: payload },
			{
				headers: {
					"Content-Type": "application/json",
					"x-api-key": auth.token,
				},
			},
		);

		if (response.status !== 200) {
			this.error(chalk.red("Failed to update compose provider."));
		}
	}
}
