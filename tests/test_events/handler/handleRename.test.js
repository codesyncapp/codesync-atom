import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import untildify from "untildify";
import getBranchName from "current-git-branch";

import {pathUtils} from "../../../lib/utils/path_utils";
import {eventHandler} from "../../../lib/events/event_handler";
import {DEFAULT_BRANCH} from "../../../lib/constants";
import {
    assertRenameEvent,
    buildAtomEnv,
    Config,
    getConfigFilePath,
    randomBaseRepoPath,
    randomRepoPath, TEST_EMAIL,
    waitFor
} from "../../helpers/helpers";

describe("handleRenameFile",  () => {
    /*
     {
        source: 'vs-code',
        created_at: '2021-08-26 18:59:51.954',
        diff: '{"old_rel_path":"old.js", "new_rel_path":"new.js"}',
        repo_path: 'tests/tests_data/test_repo_sNIVUqukDv',
        branch: 'default',
        file_relative_path: 'new.js',
        is_rename: true
      }
    */
    const repoPath = randomRepoPath();
    const baseRepoPath = randomBaseRepoPath();
    const configPath = getConfigFilePath(baseRepoPath);

    untildify.mockReturnValue(baseRepoPath);

    const pathUtilsObj = new pathUtils(repoPath, DEFAULT_BRANCH);
    const shadowRepoBranchPath = pathUtilsObj.getShadowRepoBranchPath();
    const diffsRepo = pathUtilsObj.getDiffsRepo();

    const oldRelPath = "file_1.js";

    // For file rename
    const oldFilePath = path.join(repoPath, oldRelPath);
    const newFilePath = path.join(repoPath, "new.js");
    const oldShadowFilePath = path.join(shadowRepoBranchPath, oldRelPath);
    const renamedShadowFilePath = path.join(shadowRepoBranchPath, "new.js");

    // For directory rename
    const oldDirectoryPath = path.join(repoPath, "old");
    const newDirectoryPath = path.join(repoPath, "new");
    const newDirectoryFilePath = path.join(newDirectoryPath, "file.js");
    const oldShadowDirectoryPath = path.join(shadowRepoBranchPath, "old");
    const renamedShadowDirectoryPath = path.join(shadowRepoBranchPath, "new");
    const oldShadowDirectoryFilePath = path.join(oldShadowDirectoryPath, "file.js");
    const renamedShadowDirectoryFilePath = path.join(renamedShadowDirectoryPath, "file.js");

    beforeEach(() => {
        jest.clearAllMocks();
        untildify.mockReturnValue(baseRepoPath);
        buildAtomEnv();
        atom.project.getPaths.mockReturnValue([repoPath]);
        getBranchName.mockReturnValue(DEFAULT_BRANCH);
        // Create directories
        fs.mkdirSync(baseRepoPath, { recursive: true });
        const configUtil = new Config(repoPath, configPath);
        configUtil.addRepo();
        fs.mkdirSync(repoPath, { recursive: true });
        fs.mkdirSync(diffsRepo, { recursive: true });

        fs.mkdirSync(shadowRepoBranchPath, { recursive: true });
        fs.writeFileSync(oldShadowFilePath, "use babel;");

        // For directory rename, repo will have new directory but shadow will have old repo
        fs.mkdirSync(newDirectoryPath, { recursive: true });
        fs.writeFileSync(newDirectoryFilePath, "use babel;");

        fs.mkdirSync(oldShadowDirectoryPath, { recursive: true });
        fs.writeFileSync(oldShadowDirectoryFilePath, "use babel;");
    });

    afterEach(() => {
        fs.rmSync(repoPath, { recursive: true, force: true });
        fs.rmSync(baseRepoPath, { recursive: true, force: true });
    });

    test("Event: Repo is not synced",  () => {
        const configUtil = new Config(repoPath, configPath);
        configUtil.removeRepo();
        const handler = new eventHandler();
        handler.handleRename(newFilePath, newFilePath);
        // Verify correct diff file has been generated
        let diffFiles = fs.readdirSync(diffsRepo);
        expect(diffFiles).toHaveLength(0);
        // Verify file has been renamed in the shadow repo
        expect(fs.existsSync(renamedShadowFilePath)).toBe(false);
    });

    test("Event: Synced repo, Ignorable file", () => {
        const itemPath = path.join(repoPath, ".git", "objects", "abcdef");
        const itemNewPath = path.join(repoPath, ".git", "objects", "12345");
        const handler = new eventHandler();
        handler.handleRename(itemPath, itemNewPath);
        // Verify correct diff file has been generated
        let diffFiles = fs.readdirSync(diffsRepo);
        expect(diffFiles).toHaveLength(0);
    });

    test("For File",  () => {
        // Write data to new file
        fs.writeFileSync(newFilePath, "use babel;");
        const handler = new eventHandler();
        handler.handleRename(oldFilePath, newFilePath);
        expect(assertRenameEvent(repoPath, configPath, oldRelPath, "new.js")).toBe(true);
    });

    test("for Directory",  async () => {
        const oldRelPath = path.join("old", "file.js");
        const newRelPath = path.join("new", "file.js");

        const config = {repos: {}};
        config.repos[repoPath] = {
            branches: {},
            email: TEST_EMAIL
        };
        config.repos[repoPath].branches[DEFAULT_BRANCH] = {};
        config.repos[repoPath].branches[DEFAULT_BRANCH][oldRelPath] = 1234;
        fs.writeFileSync(configPath, yaml.safeDump(config));

        // Write data to new file
        fs.writeFileSync(newFilePath, "use babel;");

        const handler = new eventHandler();
        handler.handleRename(oldDirectoryPath, newDirectoryPath);
        await waitFor(1);
        expect(assertRenameEvent(repoPath, configPath, oldRelPath, newRelPath)).toBe(true);
    });
});
