import fs from "fs";
import yaml from "js-yaml";
import untildify from "untildify";
import {isRepoSynced} from "../../../../lib/events/utils";
import {getConfigFilePath, randomBaseRepoPath, randomRepoPath} from "../../../helpers/helpers";


describe("isRepoSynced", () => {
    const baseRepoPath = randomBaseRepoPath();
    const configPath = getConfigFilePath(baseRepoPath);

    const repoPath = randomRepoPath();

    beforeEach(() => {
        // Create directories
        fs.mkdirSync(repoPath, {recursive: true});
        // Create directories
        fs.mkdirSync(baseRepoPath, {recursive: true});
        jest.clearAllMocks();
        untildify.mockReturnValue(baseRepoPath);
    });

    afterEach(() => {
        fs.rmdirSync(baseRepoPath, {recursive: true});
        fs.rmSync(repoPath, { recursive: true, force: true });
    });

    test("with no config.yml", () => {
        expect(isRepoSynced(repoPath)).toBe(false);
    });

    test("with repo not in config.yml", () => {
        fs.writeFileSync(configPath, yaml.safeDump({'repos': {}}));
        expect(isRepoSynced(repoPath)).toBe(false);
    });

    test("with repo in config.yml", () => {
        const config = {'repos': {}};
        config.repos[repoPath] = {'branches': {}};
        fs.writeFileSync(configPath, yaml.safeDump(config));
        expect(isRepoSynced(repoPath)).toBe(true);
    });

    test("with invalid config.yml", () => {
        fs.writeFileSync(configPath, "");
        expect(isRepoSynced(repoPath)).toBe(false);
    });

    test("With no repo opened", () => {
        expect(isRepoSynced("")).toBe(false);
    });
});
