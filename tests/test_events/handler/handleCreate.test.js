import fs from "fs";
import path from "path";
import untildify from "untildify";
import {DEFAULT_BRANCH} from "../../../lib/constants";
import {
    addUser,
    assertNewFileEvent,
    buildAtomEnv, Config, getConfigFilePath,
    getSyncIgnoreFilePath,
    mkDir,
    randomBaseRepoPath,
    randomRepoPath,
    rmDir,
    writeFile
} from "../../helpers/helpers";
import {pathUtils} from "../../../lib/utils/path_utils";
import {eventHandler} from "../../../lib/events/event_handler";
import {populateBuffer} from "../../../lib/codesyncd/populate_buffer";

describe("handleCreate",  () => {
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

    const newRelPath = "new.js";
    const newFilePath = path.join(repoPath, newRelPath);
    const newDirectoryPath = path.join(repoPath, "new");
    const syncIgnorePath = getSyncIgnoreFilePath(repoPath);
    const shadowFilePath = path.join(shadowRepoBranchPath, newRelPath);
    const originalsFilePath = path.join(originalsRepoBranchPath, newRelPath);
    const syncIgnoreData = ".git\n\n\n.skip_repo_1\nignore.js";
    const ignorableFilePath = path.join(repoPath, "ignore.js");

    beforeEach(() => {
        jest.clearAllMocks();
        untildify.mockReturnValue(baseRepoPath);
        buildAtomEnv();
        atom.project.getPaths.mockReturnValue([repoPath]);
        // Create directories
        fs.mkdirSync(baseRepoPath, { recursive: true });
        mkDir(repoPath);
        mkDir(diffsRepo);
        mkDir(originalsRepoBranchPath);
        mkDir(shadowRepoBranchPath);
        writeFile(newFilePath, "use babel;");
        writeFile(ignorableFilePath, "use babel;");
        writeFile(syncIgnorePath, syncIgnoreData);
        // Create .syncignore shadow
        const shadowSyncIgnore = path.join(shadowRepoBranchPath, ".syncignore");
        fs.writeFileSync(shadowSyncIgnore, syncIgnoreData);
        const configUtil = new Config(repoPath, configPath);
        configUtil.addRepo();
        // Add user
        addUser(baseRepoPath);
    });

    afterEach(() => {
        rmDir(baseRepoPath);
        rmDir(repoPath);
    });

    test("Repo not synced", () => {
        const configUtil = new Config(repoPath, configPath);
        configUtil.removeRepo();
        const handler = new eventHandler();
        handler.handleCreate(newFilePath);
        // Verify correct diff file has been generated
        let diffFiles = fs.readdirSync(diffsRepo);
        expect(diffFiles).toHaveLength(0);
        // Verify file has been created in the .shadow repo and .originals repos
        expect(fs.existsSync(shadowFilePath)).toBe(false);
        expect(fs.existsSync(originalsFilePath)).toBe(false);
    });

    test("Synced repo, Ignorable file", () => {
        const filePath = path.join(repoPath, "node_modules", "express", "index.js");
        const handler = new eventHandler();
        handler.handleCreate(filePath);
        // Verify correct diff file has been generated
        let diffFiles = fs.readdirSync(diffsRepo);
        expect(diffFiles).toHaveLength(0);
    });

    test("Valid File",  () => {
        const handler = new eventHandler();
        handler.handleCreate(newFilePath);
        expect(assertNewFileEvent(repoPath, newRelPath)).toBe(true);
    });

    test("Valid File, InActive user",  async () => {
        addUser(baseRepoPath, false);
        const handler = new eventHandler();
        handler.handleCreate(newFilePath);
        // Verify file has been created in the .shadow repo and .originals repos
        expect(fs.existsSync(shadowFilePath)).toBe(false);
        expect(fs.existsSync(originalsFilePath)).toBe(false);
        // Verify no diff file has been generated
        const diffFiles = fs.readdirSync(diffsRepo);
        expect(diffFiles).toHaveLength(0);
    });

    test("With Daemon: Valid File",  async () => {
        const handler = new eventHandler();
        handler.handleCreate(newFilePath);
        await populateBuffer();
        expect(assertNewFileEvent(repoPath, newRelPath)).toBe(true);
    });

    test("with syncignored file", () => {
        const handler = new eventHandler();
        handler.handleCreate(ignorableFilePath);
        // Verify file has been created in the .shadow repo and .originals repos
        expect(fs.existsSync(path.join(shadowRepoBranchPath, "ignore.js"))).toBe(false);
        expect(fs.existsSync(path.join(originalsRepoBranchPath, "ignore.js"))).toBe(false);
        // Verify correct diff file has been generated
        let diffFiles = fs.readdirSync(diffsRepo);
        expect(diffFiles).toHaveLength(0);
    });

    test("with shadow file there", () => {
        fs.writeFileSync(shadowFilePath, "use babel;");
        const handler = new eventHandler();
        handler.handleCreate(newFilePath);
        // Verify file has been NOT created in the .originals repos
        expect(fs.existsSync(originalsFilePath)).toBe(false);
        // Verify no diff file has been generated
        const diffFiles = fs.readdirSync(diffsRepo);
        expect(diffFiles).toHaveLength(0);
    });

    test("with originals file there", () => {
        fs.writeFileSync(originalsFilePath, "use babel;");
        const handler = new eventHandler();
        handler.handleCreate(newFilePath);
        // Verify file has NOT been created in the .shadow repo
        expect(fs.existsSync(shadowFilePath)).toBe(false);
        // Verify correct diff file has been generated
        let diffFiles = fs.readdirSync(diffsRepo);
        expect(diffFiles).toHaveLength(0);
    });

    test("with new directory", () => {
        fs.mkdirSync(newDirectoryPath, { recursive: true });
        const handler = new eventHandler();
        handler.handleCreate(newDirectoryPath);
        // Verify correct diff file has been generated
        let diffFiles = fs.readdirSync(diffsRepo);
        expect(diffFiles).toHaveLength(0);
    });
});
