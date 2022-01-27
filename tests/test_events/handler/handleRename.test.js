import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import untildify from "untildify";
import getBranchName from "current-git-branch";

import {pathUtils} from "../../../lib/utils/path_utils";
import {eventHandler} from "../../../lib/events/event_handler";
import {DEFAULT_BRANCH} from "../../../lib/constants";
import {
    addUser,
    assertRenameEvent,
    buildAtomEnv,
    Config, DUMMY_FILE_CONTENT,
    FILE_ID,
    getConfigFilePath,
    randomBaseRepoPath,
    randomRepoPath,
    TEST_EMAIL,
    waitFor,
    getSyncIgnoreFilePath
} from "../../helpers/helpers";
import {populateBuffer} from "../../../lib/codesyncd/populate_buffer";

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

    const fileRelPath = "file_1.js";
    const newRelPath = "new.js";

    // For file rename
    const oldFilePath = path.join(repoPath, fileRelPath);
    const newFilePath = path.join(repoPath, newRelPath);
    const oldShadowFilePath = path.join(shadowRepoBranchPath, fileRelPath);
    const renamedShadowFilePath = path.join(shadowRepoBranchPath, newRelPath);

    // For directory rename
    // "old/file.js" -> "new/file.js"
    const oldDirectoryPath = path.join(repoPath, "old");
    const newDirectoryPath = path.join(repoPath, "new");
    const newDirectoryFilePath = path.join(newDirectoryPath, fileRelPath);
    const oldShadowDirectoryPath = path.join(shadowRepoBranchPath, "old");
    const renamedShadowDirectoryPath = path.join(shadowRepoBranchPath, "new");
    const oldShadowDirectoryFilePath = path.join(oldShadowDirectoryPath, fileRelPath);
    const renamedShadowDirectoryFilePath = path.join(renamedShadowDirectoryPath, fileRelPath);

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
        // Add user
        addUser(baseRepoPath);

        fs.mkdirSync(repoPath, { recursive: true });
        fs.mkdirSync(diffsRepo, { recursive: true });

        fs.mkdirSync(shadowRepoBranchPath, { recursive: true });
        fs.writeFileSync(oldShadowFilePath, "use babel;");

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
        // Verify no diff file has been generated
        const diffFiles = fs.readdirSync(diffsRepo);
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
        expect(assertRenameEvent(repoPath, configPath, fileRelPath, newRelPath)).toBe(true);
    });

    test("For File in sub directory",  () => {
        const subDirName = "directory";
        const subDir = path.join(repoPath, subDirName);
        fs.mkdirSync(subDir);
        const nestedFile = path.join(subDir, fileRelPath);
        const _shadowRepoPath = path.join(shadowRepoBranchPath, subDirName);
        const _shadowFile = path.join(_shadowRepoPath, fileRelPath);
        fs.mkdirSync(_shadowRepoPath);
        fs.writeFileSync(_shadowFile, DUMMY_FILE_CONTENT);
        const _newFilePath = path.join(subDir, newRelPath);
        fs.writeFileSync(_newFilePath, DUMMY_FILE_CONTENT);
        const handler = new eventHandler();
        handler.handleRename(nestedFile, _newFilePath);
        const relPath = path.join(subDirName, fileRelPath);
        const _newRelPath = path.join(subDirName, newRelPath);

        expect(assertRenameEvent(repoPath, configPath, relPath, _newRelPath, 1, false)).toBe(true);
    });

    test("File in sync-ignored sub directory",  () => {
        const subDirName = "directory";
        const syncIgnorePath = getSyncIgnoreFilePath(repoPath);
        fs.writeFileSync(syncIgnorePath, subDirName);
        const subDir = path.join(repoPath, subDirName);
        fs.mkdirSync(subDir);
        const nestedFile = path.join(subDir, fileRelPath);
        const _shadowRepoPath = path.join(shadowRepoBranchPath, subDirName);
        const _shadowFile = path.join(_shadowRepoPath, fileRelPath);
        fs.mkdirSync(_shadowRepoPath);
        fs.writeFileSync(_shadowFile, DUMMY_FILE_CONTENT);
        const _newFilePath = path.join(subDir, newRelPath);
        fs.writeFileSync(_newFilePath, DUMMY_FILE_CONTENT);
        const handler = new eventHandler();
        handler.handleRename(nestedFile, _newFilePath);
        let diffFiles = fs.readdirSync(diffsRepo);
        expect(diffFiles).toHaveLength(0);
    });

    test("With Daemon: For File",  async () => {
        // Write data to new file
        fs.writeFileSync(newFilePath, "use babel;");
        const handler = new eventHandler();
        handler.handleRename(oldFilePath, newFilePath);
        await populateBuffer();
        expect(assertRenameEvent(repoPath, configPath, fileRelPath, newRelPath)).toBe(true);
    });

    test("For File, user is inActive",  () => {
        addUser(baseRepoPath, false);
        fs.writeFileSync(newFilePath, "use babel;");
        const handler = new eventHandler();
        handler.handleRename(oldFilePath, newFilePath);
        // Verify no diff file has been generated
        const diffFiles = fs.readdirSync(diffsRepo);
        expect(diffFiles).toHaveLength(0);
    });

    test("For file renamed to sub directory",  () => {
        // Write data to new file
        const _newRelPath = path.join("new", "file.js");
        const renamedFilePath = path.join(repoPath, _newRelPath);
        fs.mkdirSync(path.dirname(renamedFilePath), { recursive: true });
        fs.writeFileSync(renamedFilePath, "use babel;");

        const handler = new eventHandler();
        handler.handleRename(oldFilePath, renamedFilePath);
        expect(assertRenameEvent(repoPath, configPath, fileRelPath, _newRelPath)).toBe(true);
    });

    test("for Directory",  async () => {
        // For directory rename, repo will have new directory but shadow will have old repo
        fs.mkdirSync(newDirectoryPath, { recursive: true });
        fs.writeFileSync(newDirectoryFilePath, "use babel;");
        const directoryOldRelPath = path.join("old", fileRelPath);
        const directoryNewRelPath = path.join("new", fileRelPath);
        const renamedFilePath = path.join(repoPath, directoryNewRelPath);

        const config = {repos: {}};
        config.repos[repoPath] = {
            branches: {},
            email: TEST_EMAIL
        };
        config.repos[repoPath].branches[DEFAULT_BRANCH] = {};
        config.repos[repoPath].branches[DEFAULT_BRANCH][directoryOldRelPath] = 1234;
        fs.writeFileSync(configPath, yaml.safeDump(config));

        // Write data to new file
        fs.writeFileSync(renamedFilePath, "use babel;");

        const handler = new eventHandler();
        handler.handleRename(oldDirectoryPath, newDirectoryPath);
        await waitFor(1);
        expect(assertRenameEvent(repoPath, configPath, directoryOldRelPath, directoryNewRelPath)).toBe(true);
    });

    test("for Directory, renamed to nested directory",  async () => {
        // old/file_1.js -> new/nested/file_1.js
        const oldRelPath = path.join("old", fileRelPath);
        const newDirectoryPath = path.join(repoPath, "new", "nested");
        const newRelPath = path.join("new", "nested", fileRelPath);
        const renamedFilePath = path.join(newDirectoryPath, fileRelPath);

        const config = {repos: {}};
        config.repos[repoPath] = {
            branches: {},
            email: TEST_EMAIL
        };
        config.repos[repoPath].branches[DEFAULT_BRANCH] = {};
        config.repos[repoPath].branches[DEFAULT_BRANCH][oldRelPath] = FILE_ID;
        fs.writeFileSync(configPath, yaml.safeDump(config));

        // Write data to new file
        fs.mkdirSync(path.dirname(renamedFilePath), { recursive: true });
        fs.writeFileSync(renamedFilePath, DUMMY_FILE_CONTENT);
        const handler = new eventHandler();
        handler.handleRename(oldDirectoryPath, newDirectoryPath);
        await waitFor(1);
        expect(assertRenameEvent(repoPath, configPath, oldRelPath, newRelPath)).toBe(true);
    });
});
