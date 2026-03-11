import { runCommand } from "@oclif/test";
import { expect } from "chai";

describe("compose provider – command metadata", () => {
	it("shows description in --help output", async () => {
		const { stdout } = await runCommand(["compose", "provider", "--help"]);
		expect(stdout).to.include("Configure the source provider");
	});

	it("mentions GitHub in --help output", async () => {
		const { stdout } = await runCommand(["compose", "provider", "--help"]);
		expect(stdout).to.include("GitHub");
	});

	it("mentions GitLab in --help output", async () => {
		const { stdout } = await runCommand(["compose", "provider", "--help"]);
		expect(stdout).to.include("GitLab");
	});

	it("mentions Bitbucket in --help output", async () => {
		const { stdout } = await runCommand(["compose", "provider", "--help"]);
		expect(stdout).to.include("Bitbucket");
	});

	it("mentions Gitea in --help output", async () => {
		const { stdout } = await runCommand(["compose", "provider", "--help"]);
		expect(stdout).to.include("Gitea");
	});

	it("mentions custom Git in --help output", async () => {
		const { stdout } = await runCommand(["compose", "provider", "--help"]);
		expect(stdout).to.include("Git");
	});

	it("mentions raw file option in --help output", async () => {
		const { stdout } = await runCommand(["compose", "provider", "--help"]);
		expect(stdout).to.include("raw");
	});
});
