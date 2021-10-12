/**
 * @jest-environment jsdom
 */

import fs from "fs";
import yaml from "js-yaml";
import untildify from "untildify";

import extension from "../lib/codesync";
import {COMMAND, getRepoInSyncMsg, NOTIFICATION} from "../lib/constants";
import {
    SignUpHandler,
    SyncHandler,
    trackFileHandler,
    trackRepoHandler,
    unSyncHandler
} from "../lib/handlers/commands_handler";
import {createSystemDirectories} from "../lib/utils/setup_utils";
import {
    buildAtomEnv,
    Config,
    getConfigFilePath,
    getUserFilePath,
    randomBaseRepoPath,
    randomRepoPath
} from "./helpers/helpers";
import {logout} from "../lib/utils/auth_utils";
import {UnsyncRepoView} from "../lib/views";


describe("Extension",() => {
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
        createSystemDirectories();
        global.IS_CODESYNC_DEV = true;
        extension.consumeStatusBar({
            addRightTile: jest.fn(),
            getRightTiles: jest.fn(() => []),
            addLeftTile: jest.fn(),
            getLeftTiles: jest.fn(() => []),
        });
    });

    afterEach(() => {
        fs.rmSync(baseRepoPath, { recursive: true, force: true });
    });

    test("Fresh Setup, no user, no repo opened", async () => {
        atom.project.getPaths.mockReturnValue([undefined]);
        await extension.activate({});
        expect(atom.menu.add).toHaveBeenCalledTimes(1);
        expect(atom.contextMenu.add).toHaveBeenCalledTimes(1);
        expect(atom.views.addViewProvider).toHaveBeenCalledTimes(1);
        expect(atom.commands.add).toHaveBeenCalledTimes(6);

        // Register commands
        expect(atom.commands.add.mock.calls[0][0]).toStrictEqual('atom-workspace');
        expect(atom.commands.add.mock.calls[0][1]).toStrictEqual({
            "CodeSync.SignUp": SignUpHandler
        });
        expect(atom.commands.add.mock.calls[1][0]).toStrictEqual('atom-workspace');
        expect(atom.commands.add.mock.calls[1][1]).toStrictEqual({
            "CodeSync.Logout": logout
        });
        expect(atom.commands.add.mock.calls[2][0]).toStrictEqual('atom-workspace');
        expect(atom.commands.add.mock.calls[2][1]).toStrictEqual({
            "CodeSync.ConnectRepo": SyncHandler
        });
        expect(atom.commands.add.mock.calls[3][0]).toStrictEqual('atom-workspace');
        expect(atom.commands.add.mock.calls[3][1]).toStrictEqual({
            "CodeSync.DisconnectRepo": unSyncHandler
        });
        expect(atom.commands.add.mock.calls[4][0]).toStrictEqual('atom-workspace');
        expect(atom.commands.add.mock.calls[4][1]).toStrictEqual({
            "CodeSync.TrackRepo": trackRepoHandler
        });
        expect(atom.commands.add.mock.calls[5][0]).toStrictEqual('atom-workspace');
        expect(atom.commands.add.mock.calls[5][1]).toStrictEqual({
            "CodeSync.TrackFile": trackFileHandler
        });

        // Should show Welcome msg
        expect(atom.notifications.addInfo).toHaveBeenCalledTimes(1);
        expect(atom.notifications.addInfo.mock.calls[0][0]).toBe(NOTIFICATION.WELCOME_MSG);
        const options = atom.notifications.addInfo.mock.calls[0][1];
        expect(options.buttons).toHaveLength(1);
        expect(options.buttons[0].text).toStrictEqual(NOTIFICATION.JOIN);
        expect(options.dismissable).toBe(true);

        // Verify events listeners are registered just fine
        expect(atom.project.onDidChangePaths).toHaveBeenCalledTimes(1);
        expect(atom.project.onDidChangeFiles).toHaveBeenCalledTimes(1);
        expect(atom.workspace.observeTextEditors).toHaveBeenCalledTimes(1);
    });

    test("Fresh Setup, no user, repo not synced", async () => {
        atom.project.getPaths.mockReturnValue([repoPath]);
        await extension.activate({});
        expect(atom.menu.add).toHaveBeenCalledTimes(1);
        expect(atom.contextMenu.add).toHaveBeenCalledTimes(1);
        expect(atom.views.addViewProvider).toHaveBeenCalledTimes(1);
        expect(atom.commands.add).toHaveBeenCalledTimes(6);
        // Should show Welcome msg
        expect(atom.notifications.addInfo).toHaveBeenCalledTimes(1);
        expect(atom.notifications.addInfo.mock.calls[0][0]).toBe(NOTIFICATION.WELCOME_MSG);
        const options = atom.notifications.addInfo.mock.calls[0][1];
        expect(options.buttons).toHaveLength(1);
        expect(options.buttons[0].text).toStrictEqual(NOTIFICATION.JOIN);
        expect(options.dismissable).toBe(true);
    });

    test("With user, repo not synced", async () => {
        fs.writeFileSync(userFilePath, yaml.safeDump(userData));
        atom.project.getPaths.mockReturnValue([repoPath]);
        await extension.activate({});
        expect(atom.menu.add).toHaveBeenCalledTimes(1);
        expect(atom.contextMenu.add).toHaveBeenCalledTimes(1);
        expect(atom.views.addViewProvider).toHaveBeenCalledTimes(1);
        expect(atom.commands.add).toHaveBeenCalledTimes(6);

        expect(atom.notifications.addInfo).toHaveBeenCalledTimes(1);
        expect(atom.notifications.addInfo.mock.calls[0][0]).toBe(NOTIFICATION.CONNECT_REPO);
        const options = atom.notifications.addInfo.mock.calls[0][1];
        expect(options.buttons).toHaveLength(2);
        expect(options.buttons[0].text).toStrictEqual(NOTIFICATION.CONNECT);
        expect(options.buttons[1].text).toStrictEqual(NOTIFICATION.IGNORE);
        expect(options.dismissable).toBe(true);
    });

    test("With user, repo is disconnected", async () => {
        atom.project.getPaths.mockReturnValue([repoPath]);
        fs.writeFileSync(userFilePath, yaml.safeDump(userData));
        const _configData = JSON.parse(JSON.stringify(configData));
        _configData.repos[repoPath].is_disconnected = true;
        fs.writeFileSync(configPath, yaml.safeDump(_configData));
        await extension.activate({});
        expect(atom.menu.add).toHaveBeenCalledTimes(1);
        expect(atom.contextMenu.add).toHaveBeenCalledTimes(1);
        expect(atom.views.addViewProvider).toHaveBeenCalledTimes(1);
        expect(atom.commands.add).toHaveBeenCalledTimes(6);
        expect(atom.notifications.addInfo).toHaveBeenCalledTimes(1);
        expect(atom.notifications.addInfo.mock.calls[0][0]).toBe(NOTIFICATION.CONNECT_REPO);
        const options = atom.notifications.addInfo.mock.calls[0][1];
        expect(options.buttons).toHaveLength(2);
        expect(options.buttons[0].text).toStrictEqual(NOTIFICATION.CONNECT);
        expect(options.buttons[1].text).toStrictEqual(NOTIFICATION.IGNORE);
        expect(options.dismissable).toBe(true);
    });

    test("With user, repo is in sync", async () => {
        fs.mkdirSync(baseRepoPath, { recursive: true });
        const configUtil = new Config(repoPath, configPath);
        configUtil.addRepo();
        fs.writeFileSync(userFilePath, yaml.safeDump(userData));
        atom.project.getPaths.mockReturnValue([repoPath]);
        await extension.activate({});
        expect(atom.notifications.addInfo).toHaveBeenCalledTimes(1);
        const repoInSyncMsg = getRepoInSyncMsg(repoPath);
        expect(atom.notifications.addInfo.mock.calls[0][0]).toBe(repoInSyncMsg);
        const options = atom.notifications.addInfo.mock.calls[0][1];
        expect(options.buttons).toHaveLength(1);
        expect(options.buttons[0].text).toStrictEqual(NOTIFICATION.TRACK_IT);
        expect(options.dismissable).toBe(true);
    });
});
