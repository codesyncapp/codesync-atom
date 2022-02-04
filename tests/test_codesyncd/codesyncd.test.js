import fs from "fs";
import lockFile from "lockfile";

import untildify from "untildify";
import {generateSettings} from "../../lib/settings";
import {acquirePopulateBufferLock, acquireSendDiffsLock} from "../../lib/codesyncd/codesyncd";
import {CodeSyncState, CODESYNC_STATES} from "../../lib/utils/state_utils";
import {randomBaseRepoPath} from "../helpers/helpers";
import {createSystemDirectories} from "../../lib/utils/setup_utils";
import {recallDaemon} from "../../lib/codesyncd/codesyncd";

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
    untildify.mockReturnValue(baseRepoPath);
    const settings = generateSettings();
    const statusBarItem = {
        getLeftTiles: jest.fn(),
        addLeftTile: jest.fn()
    }
    statusBarItem.getLeftTiles.mockReturnValue([]);

    
    beforeEach(() => {
        jest.clearAllMocks();
        untildify.mockReturnValue(baseRepoPath);
        global.IS_CODESYNC_DEV = true;
        createSystemDirectories();
        CodeSyncState.set(CODESYNC_STATES.POPULATE_BUFFER_LOCK_ACQUIRED, false);
        CodeSyncState.set(CODESYNC_STATES.DIFFS_SEND_LOCK_ACQUIRED, false);
    });

    afterEach(() => {
        lockFile.unlockSync(settings.POPULATE_BUFFER_LOCK_FILE);
        lockFile.unlockSync(settings.DIFFS_SEND_LOCK_FILE);
        fs.rmSync(baseRepoPath, { recursive: true, force: true });
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