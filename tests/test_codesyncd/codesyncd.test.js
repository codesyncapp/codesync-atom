/**
 * @jest-environment jsdom
 */

import fs from "fs";
import path from "path";
import lockFile from "lockfile";

import untildify from "untildify";
import {generateSettings} from "../../lib/settings";
import {acquirePopulateBufferLock, acquireSendDiffsLock} from "../../lib/codesyncd/codesyncd";
import {CodeSyncState, CODESYNC_STATES} from "../../lib/utils/state_utils";
import {
    randomBaseRepoPath,
    getConfigFilePath,
    addUser,
    Config, 
    randomRepoPath,
    getUserFilePath,
    buildAtomEnv
} from "../helpers/helpers";
import {createSystemDirectories} from "../../lib/utils/setup_utils";
import {recallDaemon} from "../../lib/codesyncd/codesyncd";
import {daemonMessages} from "../../lib/views";
import {STATUS_BAR_MSGS, COMMAND, SYNCIGNORE} from "../../lib/constants";

describe("codesyncd: locks", () => {
    const baseRepoPath = randomBaseRepoPath();
    untildify.mockReturnValue(baseRepoPath);
    const settings = generateSettings();

    beforeEach(() => {
        jest.clearAllMocks();
        untildify.mockReturnValue(baseRepoPath);
        createSystemDirectories();
        const settings = generateSettings();
		CodeSyncState.set(CODESYNC_STATES.POPULATE_BUFFER_LOCK_ACQUIRED, false);
		CodeSyncState.set(CODESYNC_STATES.DIFFS_SEND_LOCK_ACQUIRED, false);
    });

    afterEach(() => {
        lockFile.unlockSync(settings.POPULATE_BUFFER_LOCK_FILE);
        lockFile.unlockSync(settings.DIFFS_SEND_LOCK_FILE);
        fs.rmSync(baseRepoPath, { recursive: true, force: true });
    });

    test("acquirePopulateBufferLock", () => {
        acquirePopulateBufferLock();
        expect(lockFile.checkSync(settings.POPULATE_BUFFER_LOCK_FILE)).toBe(true);
        expect(CodeSyncState.get(CODESYNC_STATES.POPULATE_BUFFER_LOCK_ACQUIRED)).toBe(true);
		expect(lockFile.checkSync(settings.DIFFS_SEND_LOCK_FILE)).toBe(false);
		expect(CodeSyncState.get(CODESYNC_STATES.DIFFS_SEND_LOCK_ACQUIRED)).toBe(false);
    });

	test("acquireSendDiffsLock", () => {
        acquireSendDiffsLock();
		expect(lockFile.checkSync(settings.DIFFS_SEND_LOCK_FILE)).toBe(true);
		expect(CodeSyncState.get(CODESYNC_STATES.DIFFS_SEND_LOCK_ACQUIRED)).toBe(true);
        expect(lockFile.checkSync(settings.POPULATE_BUFFER_LOCK_FILE)).toBe(false);
        expect(CodeSyncState.get(CODESYNC_STATES.POPULATE_BUFFER_LOCK_ACQUIRED)).toBe(false);
	});
});


describe("codesyncd: recallDaemon", () => {
    const baseRepoPath = randomBaseRepoPath();
    const configPath = getConfigFilePath(baseRepoPath);
    const repoPath = randomRepoPath();
    const userFilePath = getUserFilePath(baseRepoPath);
    untildify.mockReturnValue(baseRepoPath);
    const settings = generateSettings();
    const statusBarItem = {
        getLeftTiles: jest.fn(),
        addLeftTile: jest.fn()
    }
    statusBarItem.getLeftTiles.mockReturnValue([]);

    
    beforeEach(() => {
        jest.clearAllMocks();
        buildAtomEnv();
        atom.project.getPaths.mockReturnValue([repoPath]);
        untildify.mockReturnValue(baseRepoPath);
        global.IS_CODESYNC_DEV = true;
        createSystemDirectories();
        fs.mkdirSync(repoPath, {recursive: true});
        // Add repo in config and add user
        const configUtil = new Config(repoPath, configPath);
        configUtil.addRepo();
        addUser(baseRepoPath);
        CodeSyncState.set(CODESYNC_STATES.POPULATE_BUFFER_LOCK_ACQUIRED, false);
        CodeSyncState.set(CODESYNC_STATES.DIFFS_SEND_LOCK_ACQUIRED, false);
    });

    afterEach(() => {
        lockFile.unlockSync(settings.POPULATE_BUFFER_LOCK_FILE);
        lockFile.unlockSync(settings.DIFFS_SEND_LOCK_FILE);
        fs.rmSync(repoPath, { recursive: true, force: true });
        fs.rmSync(baseRepoPath, { recursive: true, force: true });
    });

    const assertCommon = (text=STATUS_BAR_MSGS.DEFAULT, times=1) => {
        const daemonMsgView = new daemonMessages({ text });
        const view = atom.views.getView(daemonMsgView);
        const priority = 1;
        expect(statusBarItem.addLeftTile).toHaveBeenCalledTimes(times);
        const tileData = statusBarItem.addLeftTile.mock.calls[0][0];
        expect(tileData).toStrictEqual({ item: view, priority });
        return true;
    };

    test("No config.yml", () => {
        fs.rmSync(configPath);
        recallDaemon(statusBarItem);
        expect(assertCommon(STATUS_BAR_MSGS.NO_CONFIG)).toBe(true);
    });

    test("No valid user", () => {
        fs.rmSync(userFilePath);
        recallDaemon(statusBarItem);
        expect(assertCommon(STATUS_BAR_MSGS.AUTHENTICATION_FAILED)).toBe(true);
    });

    test("No active user", async () => {
        fs.rmSync(userFilePath);
        addUser(baseRepoPath, false);
        recallDaemon(statusBarItem);
        expect(assertCommon(STATUS_BAR_MSGS.AUTHENTICATION_FAILED)).toBe(true);
    });

    test("No repo opened", () => {
        atom.project.getPaths.mockReturnValue([undefined]);
        recallDaemon(statusBarItem);
        expect(assertCommon(STATUS_BAR_MSGS.NO_REPO_OPEN)).toBe(true);
    });

    test("Repo opened but not synced", async () => {
        atom.project.getPaths.mockReturnValue([randomRepoPath()]);
        recallDaemon(statusBarItem);
        expect(assertCommon(STATUS_BAR_MSGS.CONNECT_REPO)).toBe(true);
    });

    test("Repo opened but is_disconnected", async () => {
        fs.rmSync(configPath);
        const configUtil = new Config(repoPath, configPath);
        configUtil.addRepo(true);
        recallDaemon(statusBarItem);
        expect(assertCommon(STATUS_BAR_MSGS.CONNECT_REPO)).toBe(true);
    });

    test("With Sub directory", async () => {
        const subDir = path.join(repoPath, "directory");
        atom.project.getPaths.mockReturnValue([subDir]);
        recallDaemon(statusBarItem);
        expect(assertCommon(STATUS_BAR_MSGS.DEFAULT)).toBe(true);
    });

    test("With sync ignored Sub directory", async () => {
        const subDirName = "directory";
        // Add subDir to .syncignore
        const syncignorePath = path.join(repoPath, SYNCIGNORE);
        fs.writeFileSync(syncignorePath, subDirName);
        const subDir = path.join(repoPath, subDirName);
        atom.project.getPaths.mockReturnValue([subDir]);
        recallDaemon(statusBarItem);
        expect(assertCommon(STATUS_BAR_MSGS.IS_SYNCIGNORED_SUB_DIR)).toBe(true);
    }); 

    test("with no lock acquired", () => {
		CodeSyncState.set(CODESYNC_STATES.POPULATE_BUFFER_LOCK_ACQUIRED, false);
		CodeSyncState.set(CODESYNC_STATES.DIFFS_SEND_LOCK_ACQUIRED, false);
        recallDaemon(statusBarItem);
        expect(lockFile.checkSync(settings.POPULATE_BUFFER_LOCK_FILE)).toBe(true);
		expect(lockFile.checkSync(settings.DIFFS_SEND_LOCK_FILE)).toBe(true);
        expect(CodeSyncState.get(CODESYNC_STATES.POPULATE_BUFFER_LOCK_ACQUIRED)).toBe(true);
		expect(CodeSyncState.get(CODESYNC_STATES.DIFFS_SEND_LOCK_ACQUIRED)).toBe(true);
    });

    test("with lock acquired for populateBuffer", () => {
        acquirePopulateBufferLock();
        recallDaemon(statusBarItem);
        expect(lockFile.checkSync(settings.POPULATE_BUFFER_LOCK_FILE)).toBe(true);
		expect(lockFile.checkSync(settings.DIFFS_SEND_LOCK_FILE)).toBe(true);
        expect(CodeSyncState.get(CODESYNC_STATES.POPULATE_BUFFER_LOCK_ACQUIRED)).toBe(true);
		expect(CodeSyncState.get(CODESYNC_STATES.DIFFS_SEND_LOCK_ACQUIRED)).toBe(true);
    });

    test("with lock acquired for diffsSend", () => {
        acquireSendDiffsLock();
        recallDaemon(statusBarItem);
        expect(lockFile.checkSync(settings.POPULATE_BUFFER_LOCK_FILE)).toBe(true);
		expect(lockFile.checkSync(settings.DIFFS_SEND_LOCK_FILE)).toBe(true);
        expect(CodeSyncState.get(CODESYNC_STATES.POPULATE_BUFFER_LOCK_ACQUIRED)).toBe(true);
		expect(CodeSyncState.get(CODESYNC_STATES.DIFFS_SEND_LOCK_ACQUIRED)).toBe(true);
    });

    test("with diffsSendLock acquried by other instance", () => {
        lockFile.lockSync(settings.DIFFS_SEND_LOCK_FILE);
        acquirePopulateBufferLock();
        recallDaemon(statusBarItem);
        expect(CodeSyncState.get(CODESYNC_STATES.POPULATE_BUFFER_LOCK_ACQUIRED)).toBe(true);
		expect(CodeSyncState.get(CODESYNC_STATES.DIFFS_SEND_LOCK_ACQUIRED)).toBe(false);
    });

    test("with populateBuffer acquried by other instance", () => {
        lockFile.lockSync(settings.POPULATE_BUFFER_LOCK_FILE);
        acquireSendDiffsLock();
        recallDaemon(statusBarItem);
        expect(CodeSyncState.get(CODESYNC_STATES.POPULATE_BUFFER_LOCK_ACQUIRED)).toBe(false);
		expect(CodeSyncState.get(CODESYNC_STATES.DIFFS_SEND_LOCK_ACQUIRED)).toBe(true);
    });
});
