'use babel';

import { RESTART_DAEMON_AFTER, STATUS_BAR_MSGS } from "../constants";
import { populateBuffer } from "./populate_buffer";
import { bufferHandler } from "./handlers/buffer_handler";
import { CodeSyncState, CODESYNC_STATES } from "../utils/state_utils";
import { statusBarMsgs } from "./utils";
import { LockUtils } from "../utils/lock_utils";

export const recallDaemon = (statusBarItem, viaDaemon=true, isServerDown=false) => {
    /*
    There are two types of locks we are using. 
    1- POPULATE_BUFFER_LOCK (Overall across all IDEs)
    2- DIFFS_SEND_LOCK (Per IDE type)
    
    Whenever a lock is acquired, we set following states in global
    1- POPULATE_BUFFER_LOCK_ACQUIRED
    2- DIFFS_SEND_LOCK_ACQUIRED
    respectively 

    Case 1: 
        If both locks have been acquired by current instance, Daemon runs both populateBuffer and bufferHandler
    Case 2: 
        If only POPULATE_BUFFER_LOCK is acquried by current instance:
        - If DIFFS_SEND_LOCK is already acquired, run only populateBuffer
        - Othewise acqurie DIFFS_SEND_LOCK and run both populateBuffer and bufferHandler
    Case 3:
        If only DIFFS_SEND_LOCK is acquried by this instance:
        - If POPULATE_BUFFER_LOCK is already acquired, run only bufferHandler
        - Othewise acqurie POPULATE_BUFFER_LOCK and run both populateBuffer and bufferHandler
    Case 4:
        If no lock is acquired by this instance, we check if locks are avilable OR if some other instance has acquired those locks
        - If locks are available, we acquire the lock
        - Recall the daemon without doing anything so that it continue to check the locks
    */
    const statusBarMsgsHandler = new statusBarMsgs(statusBarItem);
    let statusBarMsg = '';
    if (isServerDown) {
        statusBarMsg = STATUS_BAR_MSGS.SERVER_DOWN;
    } else {
        statusBarMsg = viaDaemon ? statusBarMsgsHandler.getMsg() : STATUS_BAR_MSGS.GETTING_READY;
    }
    statusBarMsgsHandler.update(statusBarMsg);
    // Do not proceed if no active user is found OR no config is found
    if ([STATUS_BAR_MSGS.AUTHENTICATION_FAILED, STATUS_BAR_MSGS.NO_CONFIG].includes(statusBarMsg)) {
        // Do not re-run daemon in case of tests
        if (global.IS_CODESYNC_DEV) return;
        return setTimeout(() => {
            recallDaemon(statusBarItem);
        }, RESTART_DAEMON_AFTER);
    }

    // Check permissions to run populateBuffer and bufferHandler
    const canPopulateBuffer = CodeSyncState.get(CODESYNC_STATES.POPULATE_BUFFER_LOCK_ACQUIRED);
    const canSendDiffs = CodeSyncState.get(CODESYNC_STATES.DIFFS_SEND_LOCK_ACQUIRED);
    // Check Locks availability
    const lockUtils = new LockUtils();
    const isPopulateBufferLockAcquired = lockUtils.checkPopulateBufferLock();
    const isSendingDiffsLockAcquired = lockUtils.checkDiffsSendLock();

    switch (true) {
        case canPopulateBuffer && canSendDiffs:
            break;
        case canPopulateBuffer && !isSendingDiffsLockAcquired:
            lockUtils.acquireSendDiffsLock();
            break;
        case canSendDiffs && !isPopulateBufferLockAcquired:
            lockUtils.acquirePopulateBufferLock();
            break;
        case !canPopulateBuffer && !canSendDiffs:
            if (!isPopulateBufferLockAcquired) lockUtils.acquirePopulateBufferLock();
            if (!isSendingDiffsLockAcquired) lockUtils.acquireSendDiffsLock();
            break;
        default:
            break;
    }
    
    // Do not re-run daemon in case of tests
    if (global.IS_CODESYNC_DEV) return;
    return setTimeout(() => {
        const canPopulateBuffer = CodeSyncState.get(CODESYNC_STATES.POPULATE_BUFFER_LOCK_ACQUIRED);
        if (canPopulateBuffer) populateBuffer();
        const canSendDiffs = CodeSyncState.get(CODESYNC_STATES.DIFFS_SEND_LOCK_ACQUIRED);
        // Buffer Handler
        const handler = new bufferHandler(statusBarItem);
        handler.run(canSendDiffs);
    }, RESTART_DAEMON_AFTER);
};
