import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import untildify from "untildify";
import fetchMock from "jest-fetch-mock";

import {
    postSelectionUnsync,
    SignUpHandler,
    SyncHandler,
    trackFileHandler,
    trackRepoHandler,
    unSyncHandler
} from "../../lib/handlers/commands_handler";
import {
    buildAtomEnv, Config, getConfigFilePath, getUserFilePath,
    randomBaseRepoPath,
    randomRepoPath,
    TEST_EMAIL
} from "../helpers/helpers";
import {getRepoInSyncMsg, NOTIFICATION} from "../../lib/constants";
import {WEB_APP_URL} from "../../lib/settings";
import {readYML} from "../../lib/utils/common";
import {DEFAULT_BRANCH} from "../../lib/constants";
import getBranchName from "current-git-branch";

const {shell} = require('electron');


describe("SignUpHandler", () => {

    test("SignUpHandler", () => {
        SignUpHandler();
        expect(global.skipAskConnect).toBe(false);
        expect(shell.openExternal).toHaveBeenCalledTimes(1);
    });
});

describe("SyncHandler", () => {
    const repoPath = randomRepoPath();
    const baseRepoPath = randomBaseRepoPath();
    const configPath = getConfigFilePath(baseRepoPath);
    const configData = {repos: {}};
    const userFilePath = getUserFilePath(baseRepoPath);
    const userData = {};
    userData[TEST_EMAIL] = {access_token: "ABC"};

    beforeEach(() => {
        jest.clearAllMocks();
        fetch.resetMocks();
        buildAtomEnv();
        untildify.mockReturnValue(baseRepoPath);
        fs.mkdirSync(baseRepoPath, {recursive: true});
        fs.mkdirSync(repoPath, {recursive: true});
        fs.writeFileSync(configPath, yaml.safeDump(configData));
        fs.writeFileSync(userFilePath, yaml.safeDump(userData));
    });

    afterEach(() => {
        fs.rmSync(repoPath, { recursive: true, force: true });
        fs.rmSync(baseRepoPath, { recursive: true, force: true });
    });

    test("No Repo Path", () => {
        atom.project.getPaths.mockReturnValue([undefined]);
        SyncHandler();
        expect(atom.notifications.addInfo).toHaveBeenCalledTimes(0);
    });

    test("repo Not In Config",  () => {
        atom.project.getPaths.mockReturnValue([repoPath]);
        const user = {
            "email": TEST_EMAIL,
            "plan": {
                REPO_COUNT: 5
            },
            "repo_count": 4
        };
        fetchMock
            .mockResponseOnce(JSON.stringify({ status: true }))
            .mockResponseOnce(JSON.stringify(user));
        SyncHandler();
        expect(atom.notifications.addInfo).toHaveBeenCalledTimes(0);
        expect(atom.notifications.addError).toHaveBeenCalledTimes(0);
        // TODO: In case we activate choose account option
        // expect(atom.notifications.addInfo).toHaveBeenCalledTimes(1);
        // expect(atom.notifications.addInfo.mock.calls[0][0]).toStrictEqual(NOTIFICATION.CHOOSE_ACCOUNT);
        // const options = atom.notifications.addInfo.mock.calls[0][1];
        // expect(options.buttons).toHaveLength(2);
        // expect(options.buttons[0].text).toStrictEqual(TEST_EMAIL);
        // expect(options.buttons[1].text).toStrictEqual(NOTIFICATION.USE_DIFFERENT_ACCOUNT);
        // expect(options.dismissable).toBe(true);
    });

    test("repo In Config", () => {
        const configUtil = new Config(repoPath, configPath);
        configUtil.addRepo();
        atom.project.getPaths.mockReturnValue([repoPath]);
        SyncHandler();
        expect(atom.notifications.addInfo).toHaveBeenCalledTimes(1);
        const repoInSyncMsg = getRepoInSyncMsg(repoPath);
        expect(atom.notifications.addInfo.mock.calls[0][0]).toStrictEqual(repoInSyncMsg);
        const options = atom.notifications.addInfo.mock.calls[0][1];
        expect(options).toBeFalsy();
    });

});

describe("unSyncHandler", () => {
    const repoPath = randomRepoPath();
    const baseRepoPath = randomBaseRepoPath();
    const configPath = getConfigFilePath(baseRepoPath);
    const configData = {repos: {}};
    const userFilePath = getUserFilePath(baseRepoPath);
    const userData = {};
    userData[TEST_EMAIL] = {access_token: "ABC"};

    beforeEach(() => {
        jest.clearAllMocks();
        buildAtomEnv();
        untildify.mockReturnValue(baseRepoPath);
        fs.mkdirSync(baseRepoPath, {recursive: true});
        fs.mkdirSync(repoPath, {recursive: true});
        fs.writeFileSync(configPath, yaml.safeDump(configData));
        fs.writeFileSync(userFilePath, yaml.safeDump(userData));
    });

    afterEach(() => {
        fs.rmSync(repoPath, { recursive: true, force: true });
        fs.rmSync(baseRepoPath, { recursive: true, force: true });
    });

    test("No Repo Path", () => {
        atom.project.getPaths.mockReturnValue([undefined]);
        unSyncHandler();
        expect(atom.notifications.addInfo).toHaveBeenCalledTimes(0);
    });

    test("Ask Unsync confirmation", () => {
        atom.project.getPaths.mockReturnValue([repoPath]);
        unSyncHandler();
        expect(atom.notifications.addWarning).toHaveBeenCalledTimes(1);
        expect(atom.notifications.addWarning.mock.calls[0][0]).toStrictEqual(NOTIFICATION.REPO_UNSYNC_CONFIRMATION);
        const options = atom.notifications.addWarning.mock.calls[0][1];
        expect(options.buttons).toHaveLength(2);
        expect(options.buttons[0].text).toStrictEqual(NOTIFICATION.YES);
        expect(options.buttons[0].onDidClick).toBeTruthy();
        expect(options.buttons[1].text).toStrictEqual(NOTIFICATION.CANCEL);
        expect(options.buttons[1].onDidClick).toBeTruthy();
        expect(options.dismissable).toBe(true);
    });

    test("Ask Unsync confirmation; Nested dir of synced repo",  async () => {
        const subDir = path.join(repoPath, "directory");
        atom.project.getPaths.mockReturnValue([subDir]);
        unSyncHandler();
        expect(atom.notifications.addWarning).toHaveBeenCalledTimes(1);
        expect(atom.notifications.addWarning.mock.calls[0][0]).toStrictEqual(NOTIFICATION.REPO_UNSYNC_CONFIRMATION);
        const options = atom.notifications.addWarning.mock.calls[0][1];
        expect(options.buttons).toHaveLength(2);
        expect(options.buttons[0].text).toStrictEqual(NOTIFICATION.YES);
        expect(options.buttons[0].onDidClick).toBeTruthy();
        expect(options.buttons[1].text).toStrictEqual(NOTIFICATION.CANCEL);
        expect(options.buttons[1].onDidClick).toBeTruthy();
        expect(options.dismissable).toBe(true);
    });
});


describe("postSelectionUnsync", () => {
    const repoPath = randomRepoPath();
    const baseRepoPath = randomBaseRepoPath();
    const configPath = getConfigFilePath(baseRepoPath);
    const configData = {repos: {}};
    const userFilePath = getUserFilePath(baseRepoPath);
    const userData = {};
    userData[TEST_EMAIL] = {access_token: "ABC"};

    beforeEach(() => {
        fetch.resetMocks();
        jest.clearAllMocks();
        buildAtomEnv();
        untildify.mockReturnValue(baseRepoPath);
        fs.mkdirSync(baseRepoPath, {recursive: true});
        fs.mkdirSync(repoPath, {recursive: true});
        fs.writeFileSync(configPath, yaml.safeDump(configData));
        fs.writeFileSync(userFilePath, yaml.safeDump(userData));
    });

    afterEach(() => {
        fs.rmSync(repoPath, { recursive: true, force: true });
        fs.rmSync(baseRepoPath, { recursive: true, force: true });
    });

    test("Repo is already inactive", async () => {
        atom.project.getPaths.mockReturnValue([repoPath]);
        configData.repos[repoPath] = {
            is_disconnected: true,
            branches: {}
        };
        fs.writeFileSync(configPath, yaml.safeDump(configData));
        await postSelectionUnsync(repoPath, null);
        expect(atom.notifications.addError).toHaveBeenCalledTimes(0);
        expect(atom.notifications.addInfo).toHaveBeenCalledTimes(0);
    });

    test("Unsyncing error from server", async () => {
        atom.project.getPaths.mockReturnValue([repoPath]);
        const configUtil = new Config(repoPath, configPath);
        configUtil.addRepo();
        fetchMock.mockResponseOnce(JSON.stringify({error: "NOT SO FAST"}));

        await postSelectionUnsync(repoPath, atom.notifications.addInfo());
        expect(atom.notifications.addError).toHaveBeenCalledTimes(1);
        expect(atom.notifications.addError.mock.calls[0][0]).toStrictEqual(NOTIFICATION.REPO_UNSYNC_FAILED);
        const options = atom.notifications.addError.mock.calls[0][1];
        expect(options).toBeFalsy();
    });

    test("Synced successfully", async () => {
        atom.project.getPaths.mockReturnValue([repoPath]);
        const configUtil = new Config(repoPath, configPath);
        configUtil.addRepo();
        fetchMock.mockResponseOnce(JSON.stringify({}));

        await postSelectionUnsync(repoPath, atom.notifications.addWarning());

        // Read config
        const config = readYML(configPath);
        expect(config.repos[repoPath].is_disconnected).toBe(true);
        expect(atom.notifications.addError).toHaveBeenCalledTimes(0);
        expect(atom.notifications.addInfo).toHaveBeenCalledTimes(1);
        expect(atom.notifications.addInfo.mock.calls[0][0]).toStrictEqual(NOTIFICATION.REPO_UNSYNCED);
    });
});

describe("trackRepoHandler", () => {
    const repoPath = randomRepoPath();
    const baseRepoPath = randomBaseRepoPath();
    const configPath = getConfigFilePath(baseRepoPath);
    const configData = {repos: {}};
    const userFilePath = getUserFilePath(baseRepoPath);
    const userData = {};
    userData[TEST_EMAIL] = {access_token: "ABC"};

    beforeEach(() => {
        jest.clearAllMocks();
        buildAtomEnv();
        untildify.mockReturnValue(baseRepoPath);
        fs.mkdirSync(baseRepoPath, {recursive: true});
        fs.mkdirSync(repoPath, {recursive: true});
        fs.writeFileSync(configPath, yaml.safeDump(configData));
        fs.writeFileSync(userFilePath, yaml.safeDump(userData));
    });

    afterEach(() => {
        fs.rmSync(repoPath, { recursive: true, force: true });
        fs.rmSync(baseRepoPath, { recursive: true, force: true });
    });

    test("No Repo Path", () => {
        atom.project.getPaths.mockReturnValue([undefined]);
        trackRepoHandler();
        expect(shell.openExternal).toHaveBeenCalledTimes(0);
    });

    test("Repo in config", async () => {
        global.atom.project.getPaths.mockReturnValue([repoPath]);
        configData.repos[repoPath] = {
            id: 1234,
            branches: {},
        };
        fs.writeFileSync(configPath, yaml.safeDump(configData));
        const playbackLink = trackRepoHandler();
        expect(shell.openExternal).toHaveBeenCalledTimes(1);
        expect(playbackLink.startsWith(WEB_APP_URL)).toBe(true);
    });

    test("With nested directory",  async () => {
        const subDir = path.join(repoPath, "directory");
        atom.project.getPaths.mockReturnValue([subDir]);
        configData.repos[repoPath] = {
            id: 1234,
            branches: {},
        };
        fs.writeFileSync(configPath, yaml.safeDump(configData));
        const playbackLink = trackRepoHandler();
        expect(shell.openExternal).toHaveBeenCalledTimes(1);
        expect(playbackLink.startsWith(WEB_APP_URL)).toBe(true);
    });
});

describe("trackFileHandler", () => {
    const repoPath = randomRepoPath();
    const baseRepoPath = randomBaseRepoPath();
    const configPath = getConfigFilePath(baseRepoPath);
    const configData = {repos: {}};
    const userFilePath = getUserFilePath(baseRepoPath);
    const userData = {};
    userData[TEST_EMAIL] = {access_token: "ABC"};

    beforeEach(() => {
        jest.clearAllMocks();
        buildAtomEnv();
        untildify.mockReturnValue(baseRepoPath);
        fs.mkdirSync(baseRepoPath, {recursive: true});
        fs.mkdirSync(repoPath, {recursive: true});
        fs.writeFileSync(configPath, yaml.safeDump(configData));
        fs.writeFileSync(userFilePath, yaml.safeDump(userData));
    });

    afterEach(() => {
        fs.rmSync(repoPath, { recursive: true, force: true });
        fs.rmSync(baseRepoPath, { recursive: true, force: true });
    });

    test("No Repo Path", () => {
        global.atom.project.getPaths.mockReturnValue([undefined]);
        trackFileHandler();
        expect(shell.openExternal).toHaveBeenCalledTimes(0);
    });

    test("No editor opened", () => {
        // Mock data
        global.atom.project.getPaths.mockReturnValue([repoPath]);
        global.atom.workspace.getActiveTextEditor.mockReturnValueOnce(undefined);
        trackFileHandler();
        expect(shell.openExternal).toHaveBeenCalledTimes(0);
        expect(global.atom.workspace.getActiveTextEditor).toHaveBeenCalledTimes(1);
    });

    test("No file is opened", () => {
        // Mock data
        global.atom.project.getPaths.mockReturnValue([repoPath]);
        global.atom.workspace.getActiveTextEditor.mockReturnValueOnce({
            getPath: jest.fn(() => {
                return null;
            })
        });
        trackFileHandler();
        expect(shell.openExternal).toHaveBeenCalledTimes(0);
    });

    test("File Path not in config", () => {
        global.atom.project.getPaths.mockReturnValue([repoPath]);
        global.atom.workspace.getActiveTextEditor.mockReturnValueOnce({
            getPath: jest.fn(() => {
                return path.join(repoPath, "file.js");
            })
        });
        getBranchName.mockReturnValueOnce(DEFAULT_BRANCH);
        // Update config file
        configData.repos[repoPath] = {
            id: 1234,
            branches: {},
        };
        configData.repos[repoPath].branches[DEFAULT_BRANCH] = {};
        fs.writeFileSync(configPath, yaml.safeDump(configData));
        trackFileHandler();
        expect(shell.openExternal).toHaveBeenCalledTimes(0);
    });

    test("File Path in config", () => {
        // Mock data
        global.atom.project.getPaths.mockReturnValue([repoPath]);
        global.atom.workspace.getActiveTextEditor.mockReturnValueOnce({
            getPath: jest.fn(() => {
                return path.join(repoPath, "file.js");
            })
        });
        getBranchName.mockReturnValueOnce(DEFAULT_BRANCH);
        // Update config file
        configData.repos[repoPath] = {
            id: 1234,
            branches: {},
        };
        configData.repos[repoPath].branches[DEFAULT_BRANCH] = {"file.js": 1234};
        fs.writeFileSync(configPath, yaml.safeDump(configData));
        trackFileHandler();
        expect(shell.openExternal).toHaveBeenCalledTimes(1);
    });

    test("With nested directory",  () => {
        // Mock data
        const subDir = path.join(repoPath, "directory");
        atom.project.getPaths.mockReturnValue([subDir]);

        global.atom.workspace.getActiveTextEditor.mockReturnValueOnce({
            getPath: jest.fn(() => {
                return path.join(repoPath, "file.js");
            })
        });

        getBranchName.mockReturnValueOnce(DEFAULT_BRANCH);
        // Update config file
        configData.repos[repoPath] = {
            id: 1234,
            branches: {}
        };
        configData.repos[repoPath].branches[DEFAULT_BRANCH] = {"file.js": 1234};
        fs.writeFileSync(configPath, yaml.safeDump(configData));

        trackFileHandler();
        expect(shell.openExternal).toHaveBeenCalledTimes(1);
    });
});
