import fs from "fs";
import path from "path";
import untildify from "untildify";
import yaml from "js-yaml";
import {readYML} from "../../../lib/utils/common";
import {DEFAULT_BRANCH, DIFF_SOURCE} from "../../../lib/constants";
import {
    buildAtomEnv, getConfigFilePath,
    getSyncIgnoreFilePath,
    mkDir,
    randomBaseRepoPath,
    randomRepoPath,
    rmDir,
    writeFile
} from "../../helpers/helpers";
import {pathUtils} from "../../../lib/utils/path_utils";
import {eventHandler} from "../../../lib/events/event_handler";

describe("handleNewFile",  () => {
    /*
         *
         {
            source: 'vs-code',
            created_at: '2021-08-26 18:59:51.954',
            diff: "",
            repo_path: 'tests/tests_data/test_repo_sNIVUqukDv',
            branch: 'default',
            file_relative_path: 'new.js',
            is_new_file: true
          }
        *
    * */

    const repoPath = randomRepoPath();
    const baseRepoPath = randomBaseRepoPath();

    const configPath = getConfigFilePath(baseRepoPath);
    untildify.mockReturnValue(baseRepoPath);

    const pathUtilsObj = new pathUtils(repoPath, DEFAULT_BRANCH);
    const diffsRepo = pathUtilsObj.getDiffsRepo();
    const shadowRepoBranchPath = pathUtilsObj.getShadowRepoBranchPath();
    const originalsRepoBranchPath = pathUtilsObj.getOriginalsRepoBranchPath();

    const newFilePath = path.join(repoPath, "new.js");
    const newDirectoryPath = path.join(repoPath, "new");
    const syncIgnorePath = getSyncIgnoreFilePath(repoPath);
    const shadowFilePath = path.join(shadowRepoBranchPath, "new.js");
    const originalsFilePath = path.join(originalsRepoBranchPath, "new.js");
    const syncIgnoreData = ".git\n\n\n.skip_repo_1\nignore.js";
    const ignorableFilePath = path.join(repoPath, "ignore.js");

    beforeEach(() => {
        jest.clearAllMocks();
        untildify.mockReturnValue(baseRepoPath);
        buildAtomEnv();
        atom.project.getPaths.mockReturnValue([repoPath]);
        // Create directories
        mkDir(repoPath);
        mkDir(diffsRepo);
        mkDir(originalsRepoBranchPath);
        mkDir(shadowRepoBranchPath);
        writeFile(newFilePath, "use babel;");
        writeFile(ignorableFilePath, "use babel;");
        writeFile(syncIgnorePath, syncIgnoreData);
    });

    afterEach(() => {
        rmDir(baseRepoPath);
        rmDir(repoPath);
    });

    test("Repo not synced", () => {
        const handler = new eventHandler();
        handler.handleNewFile(newFilePath);
        // Verify correct diff file has been generated
        let diffFiles = fs.readdirSync(diffsRepo);
        expect(diffFiles).toHaveLength(0);
        // Verify file has been created in the .shadow repo and .originals repos
        expect(fs.existsSync(shadowFilePath)).toBe(false);
        expect(fs.existsSync(originalsFilePath)).toBe(false);
    });

    test("Synced repo, Ignorable file", () => {
        const config = {'repos': {}};
        config.repos[repoPath] = {'branches': {}};
        fs.writeFileSync(configPath, yaml.safeDump(config));
        const filePath = path.join(repoPath, "node_modules", "express", "index.js");
        const handler = new eventHandler();
        handler.handleNewFile(filePath);
        // Verify correct diff file has been generated
        let diffFiles = fs.readdirSync(diffsRepo);
        expect(diffFiles).toHaveLength(0);
    });

    test("Valid File",  () => {
        const config = {'repos': {}};
        config.repos[repoPath] = {'branches': {}};
        fs.writeFileSync(configPath, yaml.safeDump(config));
        const handler = new eventHandler();
        handler.handleNewFile(newFilePath);
        // Verify file has been created in the .shadow repo and .originals repos
        expect(fs.existsSync(shadowFilePath)).toBe(true);
        expect(fs.existsSync(originalsFilePath)).toBe(true);
        // Verify correct diff file has been generated
        let diffFiles = fs.readdirSync(diffsRepo);
        expect(diffFiles).toHaveLength(1);
        const diffFilePath = path.join(diffsRepo, diffFiles[0]);
        const diffData = readYML(diffFilePath);
        expect(diffData.source).toEqual(DIFF_SOURCE);
        expect(diffData.is_new_file).toBe(true);
        expect(diffData.is_rename).toBeFalsy();
        expect(diffData.is_deleted).toBeFalsy();
        expect(diffData.repo_path).toEqual(repoPath);
        expect(diffData.branch).toEqual(DEFAULT_BRANCH);
        expect(diffData.file_relative_path).toEqual("new.js");
        expect(diffData.diff).toEqual("");
    });

    test("with syncignored file", () => {
        const config = {'repos': {}};
        config.repos[repoPath] = {'branches': {}};
        fs.writeFileSync(configPath, yaml.safeDump(config));

        const handler = new eventHandler();
        handler.handleNewFile(ignorableFilePath);
        // Verify file has been created in the .shadow repo and .originals repos
        expect(fs.existsSync(path.join(shadowRepoBranchPath, "ignore.js"))).toBe(false);
        expect(fs.existsSync(path.join(originalsRepoBranchPath, "ignore.js"))).toBe(false);
        // Verify correct diff file has been generated
        let diffFiles = fs.readdirSync(diffsRepo);
        expect(diffFiles).toHaveLength(0);
    });

    test("with shadow file there", () => {
        const config = {'repos': {}};
        config.repos[repoPath] = {'branches': {}};
        fs.writeFileSync(configPath, yaml.safeDump(config));

        fs.writeFileSync(shadowFilePath, "use babel;");
        const handler = new eventHandler();
        handler.handleNewFile(newFilePath);
        // Verify file has been NOT created in the .originals repos
        expect(fs.existsSync(originalsFilePath)).toBe(false);
        // Verify correct diff file has been generated
        let diffFiles = fs.readdirSync(diffsRepo);
        expect(diffFiles).toHaveLength(0);
    });

    test("with originals file there", () => {
        const config = {'repos': {}};
        config.repos[repoPath] = {'branches': {}};
        fs.writeFileSync(configPath, yaml.safeDump(config));

        fs.writeFileSync(originalsFilePath, "use babel;");
        const handler = new eventHandler();
        handler.handleNewFile(newFilePath);
        // Verify file has NOT been created in the .shadow repo
        expect(fs.existsSync(shadowFilePath)).toBe(false);
        // Verify correct diff file has been generated
        let diffFiles = fs.readdirSync(diffsRepo);
        expect(diffFiles).toHaveLength(0);
    });

    test("with new directory", () => {
        const config = {'repos': {}};
        config.repos[repoPath] = {'branches': {}};
        fs.writeFileSync(configPath, yaml.safeDump(config));
        fs.mkdirSync(newDirectoryPath, { recursive: true });
        const handler = new eventHandler();
        handler.handleNewFile(newDirectoryPath);
        // Verify correct diff file has been generated
        let diffFiles = fs.readdirSync(diffsRepo);
        expect(diffFiles).toHaveLength(0);
    });
});
