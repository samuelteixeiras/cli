import { Command, Flags } from "@oclif/core";
import axios from "axios";
import chalk from "chalk";
import inquirer from "inquirer";

import { type Environment, getProject, getProjects } from "../../utils/shared.js";
import { readAuthConfig } from "../../utils/utils.js";

type Compose = {
	appName: string;
	composeId: string;
	name: string;
};

export default class ComposeDeploy extends Command {
	static override description = "Deploy a compose service in a project.";

	static override examples = [
		"$ <%= config.bin %> compose deploy",
		"$ <%= config.bin %> compose deploy --composeId <id>",
	];

	static override flags = {
		composeId: Flags.string({
			char: "c",
			description: "ID of the compose service to deploy",
			required: false,
		}),
		environmentId: Flags.string({
			char: "e",
			description: "ID of the environment",
			required: false,
		}),
		projectId: Flags.string({
			char: "p",
			description: "ID of the project",
			required: false,
		}),
		skipConfirm: Flags.boolean({
			char: "y",
			default: false,
			description: "Skip confirmation prompt",
		}),
	};

	public async run(): Promise<void> {
		const auth = await readAuthConfig(this);
		const { flags } = await this.parse(ComposeDeploy);
		const { skipConfirm } = flags;
		let { composeId, environmentId, projectId } = flags;

		if (!projectId || !environmentId || !composeId) {
			this.log(chalk.blue.bold("\n  Listing all Projects \n"));
			const projects = await getProjects(auth, this);

			if (!projectId) {
				const { project } = await inquirer.prompt<{ project: { name: string; projectId: string } }>([
					{
						choices: projects.map((p) => ({ name: p.name, value: p })),
						message: "Select a project:",
						name: "project",
						type: "list",
					},
				]);
				projectId = project.projectId;
			}

			const projectDetails = await getProject(projectId, auth, this);

			if (!environmentId) {
				if (!projectDetails.environments || projectDetails.environments.length === 0) {
					this.error(chalk.yellow("No environments found in this project."));
				}

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
				environmentId = environment.environmentId;
			}

			if (!composeId) {
				const selectedEnv: Environment = projectDetails.environments.find(
					(e: Environment) => e.environmentId === environmentId,
				);
				const composes: Compose[] = selectedEnv?.compose ?? [];

				if (composes.length === 0) {
					this.error(chalk.yellow("No compose services found in this environment."));
				}

				const { selectedCompose } = await inquirer.prompt<{ selectedCompose: string }>([
					{
						choices: composes.map((c) => ({
							name: `${c.appName}:${c.name}`,
							value: c.composeId,
						})),
						message: "Select the compose service to deploy:",
						name: "selectedCompose",
						type: "list",
					},
				]);
				composeId = selectedCompose;
			}
		}

		if (!skipConfirm) {
			const { proceed } = await inquirer.prompt<{ proceed: boolean }>([
				{
					default: false,
					message: "Are you sure you want to deploy this compose service?",
					name: "proceed",
					type: "confirm",
				},
			]);

			if (!proceed) {
				this.error(chalk.yellow("Compose deployment cancelled."));
			}
		}

		try {
			const response = await axios.post(
				`${auth.url}/api/trpc/compose.deploy`,
				{ json: { composeId } },
				{
					headers: {
						"Content-Type": "application/json",
						"x-api-key": auth.token,
					},
				},
			);

			if (response.status !== 200) {
				this.error(chalk.red("Error deploying compose service."));
			}

			this.log(chalk.green("\n✓ Compose service deployed successfully."));
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			this.error(chalk.red(`Error deploying compose service: ${message}`));
		}
	}
}
