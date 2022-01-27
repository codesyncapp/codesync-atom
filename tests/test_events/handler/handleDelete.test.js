import fs from "fs";
import path from "path";
import untildify from "untildify";
import getBranchName from "current-git-branch";

import {pathUtils} from "../../../lib/utils/path_utils";
import {eventHandler} from "../../../lib/events/event_handler";
import {DEFAULT_BRANCH} from "../../../lib/constants";
import {
    addUser,
    assertFileDeleteEvent,
    buildAtomEnv,
    Config,
    getConfigFilePath,
    randomBaseRepoPath,
    randomRepoPath,
    waitFor,
    getSyncIgnoreFilePath,
    DUMMY_FILE_CONTENT
} from "../../helpers/helpers";
import {populateBuffer} from "../../../lib/codesyncd/populate_buffer";

describe("handleDelete",  () => {
    /*
     {
        source: 'vs-code',
        created_at: '2021-08-26 18:59:51.954',
        diff: "",
        repo_path: 'tests/tests_data/test_repo_sNIVUqukDv',
        branch: 'default',
        file_relative_path: 'new.js',
        is_deleted: true
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
    // For file
    const filePath = path.join(repoPath, fileRelPath);
    const cacheRepoBranchPath = pathUtilsObj.getDeletedRepoBranchPath();
    const cacheFilePath = path.join(cacheRepoBranchPath, fileRelPath);
    const shadowFilePath = path.join(shadowRepoBranchPath, fileRelPath);

    // For directory
    const directoryPath = path.join(repoPath, "directory");
    const directoryFilePath = path.join(directoryPath, fileRelPath);
    const dirFileRelPath = path.join("directory", fileRelPath);
    const shadowDirectoryPath = path.join(shadowRepoBranchPath, "directory");
    const shadowDirectoryFilePath = path.join(shadowDirectoryPath, fileRelPath);

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
        fs.writeFileSync(shadowFilePath, "use babel;");

        // For directory rename, repo will have new directory but shadow will have old repo
        fs.mkdirSync(directoryPath, { recursive: true });
        fs.writeFileSync(directoryFilePath, "use babel;");

        fs.mkdirSync(shadowDirectoryPath, { recursive: true });
        fs.writeFileSync(shadowDirectoryFilePath, "use babel;");
    });

    afterEach(() => {
        fs.rmSync(repoPath, { recursive: true, force: true });
        fs.rmSync(baseRepoPath, { recursive: true, force: true });
    });

    test("Repo is not synced",  () => {
        const configUtil = new Config(repoPath, configPath);
        configUtil.removeRepo();
        const handler = new eventHandler();
        handler.handleDelete(filePath);
        // Verify correct diff file has been generated
        let diffFiles = fs.readdirSync(diffsRepo);
        expect(diffFiles).toHaveLength(0);
        // Verify file was not copied to .deleted
        expect(fs.existsSync(cacheFilePath)).toBe(false);
    });

    test("Event: Synced repo, Ignorable file", () => {
        const filePath = path.join(repoPath, "node_modules", "express", "index.js");
        const handler = new eventHandler();
        handler.handleDelete(filePath);
        // Verify correct diff file has been generated
        let diffFiles = fs.readdirSync(diffsRepo);
        expect(diffFiles).toHaveLength(0);
    });

    test("Repo synced, shadow exists",  () => {
        const handler = new eventHandler();
        handler.handleDelete(filePath);
        expect(assertFileDeleteEvent(repoPath, fileRelPath)).toBe(true);
    });

    test("Sub dirctory, shadow exists",  () => {
        const subDirName = "directory";
        const subDir = path.join(repoPath, subDirName);
        const nestedFile = path.join(subDir, fileRelPath);
        const _shadowRepoPath = path.join(shadowRepoBranchPath, subDirName);
        const _shadowFile = path.join(_shadowRepoPath, fileRelPath);
        fs.writeFileSync(_shadowFile, DUMMY_FILE_CONTENT);

        const handler = new eventHandler();
        handler.handleDelete(nestedFile);
        const relPath = path.join(subDirName, fileRelPath);
        expect(assertFileDeleteEvent(repoPath, relPath)).toBe(true);
    });

    test("Sync ignored sub dirctory, shadow exists",  () => {
        const subDirName = "directory";
        const syncIgnorePath = getSyncIgnoreFilePath(repoPath);
        fs.writeFileSync(syncIgnorePath, subDirName);
        const subDir = path.join(repoPath, subDirName);
        const nestedFile = path.join(subDir, fileRelPath);
        const _shadowRepoPath = path.join(shadowRepoBranchPath, subDirName);
        const _shadowFile = path.join(_shadowRepoPath, fileRelPath);
        fs.writeFileSync(_shadowFile, DUMMY_FILE_CONTENT);
        const handler = new eventHandler();
        handler.handleDelete(nestedFile);
        // Verify correct diff file has been generated
        let diffFiles = fs.readdirSync(diffsRepo);
        expect(diffFiles).toHaveLength(0);
    });

    test("With Daemon: Repo synced, shadow exists",  async () => {
        const handler = new eventHandler();
        handler.handleDelete(filePath);
        await populateBuffer();
        expect(assertFileDeleteEvent(repoPath, fileRelPath)).toBe(true);
    });

    test("Repo synced, shadow does NOT exists",  () => {
        fs.rmSync(shadowFilePath);
        const handler = new eventHandler();
        handler.handleDelete(filePath);
        // Verify that file is not copied to .delete directory
        expect(fs.existsSync(cacheFilePath)).toBe(false);
        // Verify correct diff file has been generated
        let diffFiles = fs.readdirSync(diffsRepo);
        expect(diffFiles).toHaveLength(0);
    });

    test("Repo synced, .delete file exists",  () => {
        fs.mkdirSync(cacheRepoBranchPath, { recursive: true });
        fs.writeFileSync(cacheFilePath, "use babel;");
        const handler = new eventHandler();
        handler.handleDelete(filePath);
        // Verify correct diff file has been generated
        let diffFiles = fs.readdirSync(diffsRepo);
        expect(diffFiles).toHaveLength(0);
    });

    test("Repo synced, Directory delete event",  async () => {
        const handler = new eventHandler();
        handler.handleDelete(directoryPath);
        await waitFor(1);
        expect(assertFileDeleteEvent(repoPath, dirFileRelPath, true)).toBe(true);
    });

    test("Repo synced, user is inActive",  () => {
        addUser(baseRepoPath, false);
        const handler = new eventHandler();
        handler.handleDelete(filePath);
        // Verify that file is not copied to .delete directory
        expect(fs.existsSync(cacheFilePath)).toBe(false);
        // Verify correct diff file has been generated
        let diffFiles = fs.readdirSync(diffsRepo);
        expect(diffFiles).toHaveLength(0);
    });
});

describe("handleDirectoryDeleteDiffs", () => {
    /*
     {
        source: 'vs-code',
        created_at: '2021-08-26 18:59:51.954',
        diff: '',
        repo_path: 'tests/tests_data/test_repo_sNIVUqukDv',
        branch: 'default',
        file_relative_path: 'new.js',
        is_deleted: true
      }
    * */

    const repoPath = randomRepoPath();
    const baseRepoPath = randomBaseRepoPath();

    untildify.mockReturnValue(baseRepoPath);

    const pathUtilsObj = new pathUtils(repoPath, DEFAULT_BRANCH);
    const diffsRepo = pathUtilsObj.getDiffsRepo();
    const shadowRepoBranchPath = pathUtilsObj.getShadowRepoBranchPath();
    const cacheRepoBranchPath = pathUtilsObj.getDeletedRepoBranchPath();

    const fileRelPath = "file_1.js";
    const shadowDirectoryPath = path.join(shadowRepoBranchPath, "directory");
    const shadowFilePath = path.join(shadowDirectoryPath, fileRelPath);
    const dirFileRelPath = path.join("directory", fileRelPath);
    const cacheFilePath = path.join(cacheRepoBranchPath, dirFileRelPath);

    beforeEach(() => {
        jest.clearAllMocks();
        untildify.mockReturnValue(baseRepoPath);
        fs.mkdirSync(repoPath, { recursive: true });
        fs.mkdirSync(diffsRepo, { recursive: true });
        fs.mkdirSync(shadowDirectoryPath, { recursive: true });
        fs.writeFileSync(shadowFilePath, "use babel;");
    });

    afterEach(() => {
        fs.rmSync(repoPath, { recursive: true, force: true });
        fs.rmSync(baseRepoPath, { recursive: true, force: true });
    });

    test("NOT in .deleted",  async () => {
        const handler = new eventHandler(repoPath);
        handler.handleDirectoryDeleteDiffs("directory");
        await waitFor(1);
        expect(assertFileDeleteEvent(repoPath, dirFileRelPath)).toBe(true);
    });

    test("with file already in .deleted",  async () => {
        fs.mkdirSync(path.join(cacheRepoBranchPath, "directory"), { recursive: true });
        fs.writeFileSync(cacheFilePath, "use babel;");
        const handler = new eventHandler(repoPath);
        handler.handleDirectoryDeleteDiffs("directory");
        await waitFor(1);
        // Verify correct diff file has been generated
        let diffFiles = fs.readdirSync(diffsRepo);
        expect(diffFiles).toHaveLength(0);
    });

});
