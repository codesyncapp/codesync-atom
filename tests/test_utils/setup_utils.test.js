import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import untildify from "untildify";

import {
    buildAtomEnv,
    getConfigFilePath,
    getUserFilePath,
    randomBaseRepoPath,
    randomRepoPath,
    rmDir,
    mkDir,
    writeFile,
    Config, addUser
} from "../helpers/helpers";
import {
    getRepoInSyncMsg,
    getDirectorySyncIgnoredMsg,
    getDirectoryIsSyncedMsg,
    NOTIFICATION,
    SYNCIGNORE} from "../../lib/constants";
import {createSystemDirectories, setupCodeSync, showConnectRepoView, 
    showLogIn, showRepoIsSyncIgnoredView} from "../../lib/utils/setup_utils";
import { CodeSyncState, CODESYNC_STATES } from "../../lib/utils/state_utils";

describe("createSystemDirectories",  () => {
    const baseRepoPath = randomBaseRepoPath();

    beforeEach(() => {
        jest.clearAllMocks();
        untildify.mockReturnValue(baseRepoPath);
    });

    afterEach(() => {
        rmDir(baseRepoPath);
    });

    test('createSystemDirectories',  () => {
        createSystemDirectories();
        const lsResult = fs.readdirSync(baseRepoPath);
        expect(lsResult.includes(".diffs")).toBe(true);
        expect(lsResult.includes(".originals")).toBe(true);
        expect(lsResult.includes(".shadow")).toBe(true);
        expect(lsResult.includes(".deleted")).toBe(true);
        expect(lsResult.includes("config.yml")).toBe(true);
        expect(lsResult.includes("sequence_token.yml")).toBe(true);
    });
});

describe("setupCodeSync",  () => {
    const baseRepoPath = randomBaseRepoPath();
    const repoPath = randomRepoPath();
    const userFilePath = getUserFilePath(baseRepoPath);
    const userData = {"dummy_email": {access_token: "ABC"}};

    const configPath = getConfigFilePath(baseRepoPath);
    const configData = {repos: {}};
    configData.repos[repoPath] = {branches: {}};

    beforeEach(() => {
        jest.clearAllMocks();
        buildAtomEnv();
        untildify.mockReturnValue(baseRepoPath);
        mkDir(baseRepoPath);
        mkDir(repoPath);
        CodeSyncState.set(CODESYNC_STATES.REPO_IS_IN_SYNC, false);
        CodeSyncState.set(CODESYNC_STATES.USER_EMAIL, null);
    });

    afterEach(() => {
        rmDir(repoPath);
        rmDir(baseRepoPath);
    });

    test('with no user.yml', async () => {
        const port = await setupCodeSync(undefined);
        const lsResult = fs.readdirSync(baseRepoPath);
        expect(lsResult.includes(".diffs")).toBe(true);
        expect(lsResult.includes(".originals")).toBe(true);
        expect(lsResult.includes(".shadow")).toBe(true);
        expect(lsResult.includes(".deleted")).toBe(true);
        expect(lsResult.includes("config.yml")).toBe(true);
        expect(lsResult.includes("sequence_token.yml")).toBe(true);
        // should return port number
        expect(port).toBeTruthy();
        expect(atom.notifications.addInfo).toHaveBeenCalledTimes(1);
        expect(atom.notifications.addInfo.mock.calls[0][0]).toBe(NOTIFICATION.WELCOME_MSG);
        const options = atom.notifications.addInfo.mock.calls[0][1];
        expect(options.buttons).toHaveLength(1);
        expect(options.buttons[0].text).toStrictEqual(NOTIFICATION.JOIN);
        expect(options.dismissable).toBe(true);
    });

    test('with empty user.yml', async () => {
        writeFile(userFilePath, yaml.safeDump({}));
        const port = await setupCodeSync(undefined);
        // should return port number
        expect(port).toBeTruthy();
        expect(atom.notifications.addInfo).toHaveBeenCalledTimes(1);
        expect(atom.notifications.addInfo.mock.calls[0][0]).toBe(NOTIFICATION.WELCOME_MSG);
        const options = atom.notifications.addInfo.mock.calls[0][1];
        expect(options.buttons).toHaveLength(1);
        expect(options.buttons[0].text).toStrictEqual(NOTIFICATION.JOIN);
        expect(options.dismissable).toBe(true);
        fs.rmSync(userFilePath);
    });

    test('with no active user', async () => {
        addUser(baseRepoPath, false);
        const port = await setupCodeSync(repoPath);
        // should return port number
        expect(port).toBeTruthy();
        expect(atom.notifications.addInfo).toHaveBeenCalledTimes(1);
        expect(atom.notifications.addInfo.mock.calls[0][0]).toBe(NOTIFICATION.WELCOME_MSG);
        const options = atom.notifications.addInfo.mock.calls[0][1];
        expect(options.buttons).toHaveLength(1);
        expect(options.buttons[0].text).toBe(NOTIFICATION.JOIN);
        fs.rmSync(userFilePath);
    });

    test('with user no repo opened', async () => {
        fs.writeFileSync(userFilePath, yaml.safeDump(userData));
        await setupCodeSync("");
        expect(atom.notifications.addInfo).toHaveBeenCalledTimes(0);
    });

    test('with user and repo not synced', async () => {
        writeFile(userFilePath, yaml.safeDump(userData));
        atom.project.getPaths.mockReturnValue([repoPath]);
        const port = await setupCodeSync(repoPath);
        // should return port number
        expect(port).toBeTruthy();
        expect(atom.notifications.addInfo).toHaveBeenCalledTimes(1);
        expect(atom.notifications.addInfo.mock.calls[0][0]).toBe(NOTIFICATION.CONNECT_REPO);
        const options = atom.notifications.addInfo.mock.calls[0][1];
        expect(options.buttons).toHaveLength(2);
        expect(options.buttons[0].text).toStrictEqual(NOTIFICATION.CONNECT);
        expect(options.buttons[1].text).toStrictEqual(NOTIFICATION.IGNORE);
        expect(options.dismissable).toBe(true);
        fs.rmSync(userFilePath);
        expect(CodeSyncState.get(CODESYNC_STATES.REPO_IS_IN_SYNC)).toBe(false);
        expect(CodeSyncState.get(CODESYNC_STATES.IS_SUB_DIR)).toBe(false);
    });

    test('with synced repo',  async () => {
        writeFile(userFilePath, yaml.safeDump(userData));
        const configUtil = new Config(repoPath, configPath);
        configUtil.addRepo();
        addUser(baseRepoPath);
        atom.project.getPaths.mockReturnValue([repoPath]);
        const port = await setupCodeSync(repoPath);
        // should return port number
        expect(port).toBeFalsy();
        expect(atom.notifications.addInfo).toHaveBeenCalledTimes(1);
        const msg = getRepoInSyncMsg(repoPath);
        expect(atom.notifications.addInfo.mock.calls[0][0]).toBe(msg);
        const options = atom.notifications.addInfo.mock.calls[0][1];
        expect(options.buttons).toHaveLength(1);
        expect(options.buttons[0].text).toStrictEqual(NOTIFICATION.TRACK_IT);
        expect(options.dismissable).toBe(true);
        fs.rmSync(userFilePath);
        expect(CodeSyncState.get(CODESYNC_STATES.REPO_IS_IN_SYNC)).toBe(true);
        expect(CodeSyncState.get(CODESYNC_STATES.IS_SUB_DIR)).toBe(false);
    });

    test('showConnectRepoView',  async () => {
        writeFile(configPath, yaml.safeDump({repos: {}}));
        const shouldShowConnectRepoView = showConnectRepoView(repoPath);
        expect(shouldShowConnectRepoView).toBe(true);
    });

    test('showRepoIsSyncIgnoredView',  async () => {
        fs.writeFileSync(configPath, yaml.safeDump({repos: {}}));
        const shouldShow = showRepoIsSyncIgnoredView(repoPath);
        expect(shouldShow).toBe(false);
    });

    test('with sub directory',  async () => {
        fs.writeFileSync(userFilePath, yaml.safeDump(userData));
        const configUtil = new Config(repoPath, configPath);
        configUtil.addRepo();
        addUser(baseRepoPath);
        const subDir = path.join(repoPath, "directory");
        atom.project.getPaths.mockReturnValue([repoPath]);
        const port = await setupCodeSync(subDir);
        // should return port number
        expect(port).toBeFalsy();
        expect(atom.notifications.addInfo).toHaveBeenCalledTimes(1);
        const json = getDirectoryIsSyncedMsg(subDir, repoPath);
        expect(atom.notifications.addInfo.mock.calls[0][0]).toBe(json.msg);
        const options = atom.notifications.addInfo.mock.calls[0][1];
        expect(options.buttons).toHaveLength(1);
        expect(options.buttons[0].text).toStrictEqual(NOTIFICATION.TRACK_PARENT_REPO);
        expect(options.dismissable).toBe(true);
        expect(options.detail).toStrictEqual(json.detail);
        fs.rmSync(userFilePath);
        expect(CodeSyncState.get(CODESYNC_STATES.REPO_IS_IN_SYNC)).toBe(true);
        expect(CodeSyncState.get(CODESYNC_STATES.IS_SUB_DIR)).toBe(true);
        expect(CodeSyncState.get(CODESYNC_STATES.IS_SYNCIGNORED_SUB_DIR)).toBe(false);
    });

    test('with sub directory syncignored',  async () => {
        const subDirName = "directory";
        fs.writeFileSync(userFilePath, yaml.safeDump(userData));
        const configUtil = new Config(repoPath, configPath);
        configUtil.addRepo();
        addUser(baseRepoPath);
        // Add subDir to .syncignore
        const syncignorePath = path.join(repoPath, SYNCIGNORE);
        fs.writeFileSync(syncignorePath, subDirName);
        const subDir = path.join(repoPath, subDirName);
        atom.project.getPaths.mockReturnValue([subDir]);
        const port = await setupCodeSync(subDir);
        // should return port number
        expect(port).toBeTruthy();
        expect(atom.notifications.addInfo).toHaveBeenCalledTimes(1);
        const msg = getDirectorySyncIgnoredMsg(subDir, repoPath);
        expect(atom.notifications.addInfo.mock.calls[0][0]).toStrictEqual(msg);
        const options = atom.notifications.addInfo.mock.calls[0][1];
        expect(options.buttons).toHaveLength(3);
        expect(options.buttons[0].text).toStrictEqual(NOTIFICATION.OPEN_SYNCIGNORE);
        expect(options.buttons[1].text).toStrictEqual(NOTIFICATION.TRACK_PARENT_REPO);
        expect(options.buttons[2].text).toStrictEqual(NOTIFICATION.UNSYNC_PARENT_REPO);
        expect(options.dismissable).toBe(true);
        fs.rmSync(userFilePath);
        expect(CodeSyncState.get(CODESYNC_STATES.REPO_IS_IN_SYNC)).toBe(false);
        expect(CodeSyncState.get(CODESYNC_STATES.IS_SUB_DIR)).toBe(true);
        expect(CodeSyncState.get(CODESYNC_STATES.IS_SYNCIGNORED_SUB_DIR)).toBe(true);
    });

    test('with sub directory and parent is_disconnected',  async () => {
        fs.writeFileSync(userFilePath, yaml.safeDump(userData));
        const configUtil = new Config(repoPath, configPath);
        configUtil.addRepo(true);
        addUser(baseRepoPath);
        const subDir = path.join(repoPath, "directory");
        atom.project.getPaths.mockReturnValue([repoPath]);
        const port = await setupCodeSync(subDir);
        // should return port number
        expect(port).toBeTruthy();
        expect(atom.notifications.addInfo).toHaveBeenCalledTimes(1);
        expect(atom.notifications.addInfo.mock.calls[0][0]).toBe(NOTIFICATION.CONNECT_REPO);
        const options = atom.notifications.addInfo.mock.calls[0][1];
        expect(options.buttons).toHaveLength(2);
        expect(options.buttons[0].text).toStrictEqual(NOTIFICATION.CONNECT);
        expect(options.buttons[1].text).toStrictEqual(NOTIFICATION.IGNORE);
        expect(options.dismissable).toBe(true);
        fs.rmSync(userFilePath);
        expect(CodeSyncState.get(CODESYNC_STATES.REPO_IS_IN_SYNC)).toBe(false);
        expect(CodeSyncState.get(CODESYNC_STATES.IS_SUB_DIR)).toBe(true);
        expect(CodeSyncState.get(CODESYNC_STATES.IS_SYNCIGNORED_SUB_DIR)).toBe(false);
    });
});


describe("showLogin",  () => {
    const baseRepoPath = randomBaseRepoPath();
    const userFilePath = getUserFilePath(baseRepoPath);
    const userData = {"dummy_email": {access_token: "ABC"}};

    beforeEach(() => {
        jest.clearAllMocks();
        untildify.mockReturnValue(baseRepoPath);
        mkDir(baseRepoPath);
    });

    afterEach(() => {
        rmDir(baseRepoPath);
    });

    test('with no user.yml',   () => {
        const shouldShowLogin = showLogIn();
        expect(shouldShowLogin).toBe(true);
    });

    test('with empty user.yml',  async () => {
        writeFile(userFilePath, yaml.safeDump({}));
        const shouldShowLogin = showLogIn();
        expect(shouldShowLogin).toBe(true);
        fs.rmSync(userFilePath);
    });

    test('with no active user',  async () => {
        addUser(baseRepoPath, false);
        const shouldShowLogin = showLogIn();
        expect(shouldShowLogin).toBe(true);
        fs.rmSync(userFilePath);
    });

    test('with user',  async () => {
        writeFile(userFilePath, yaml.safeDump(userData));
        const shouldShowLogin = showLogIn();
        expect(shouldShowLogin).toBe(false);
        fs.rmSync(userFilePath);
    });
});
