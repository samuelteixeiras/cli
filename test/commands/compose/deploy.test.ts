import { expect } from "chai";
import { runCommand } from "@oclif/test";

describe("compose deploy – command metadata", () => {
	it("shows description in --help output", async () => {
		const { stdout } = await runCommand(["compose", "deploy", "--help"]);
		expect(stdout).to.include("Deploy a compose service in a project.");
	});

	it("shows --composeId flag in --help output", async () => {
		const { stdout } = await runCommand(["compose", "deploy", "--help"]);
		expect(stdout).to.include("--composeId");
	});

	it("shows --projectId flag in --help output", async () => {
		const { stdout } = await runCommand(["compose", "deploy", "--help"]);
		expect(stdout).to.include("--projectId");
	});

	it("shows --environmentId flag in --help output", async () => {
		const { stdout } = await runCommand(["compose", "deploy", "--help"]);
		expect(stdout).to.include("--environmentId");
	});

	it("shows --skipConfirm flag in --help output", async () => {
		const { stdout } = await runCommand(["compose", "deploy", "--help"]);
		expect(stdout).to.include("--skipConfirm");
	});
});
