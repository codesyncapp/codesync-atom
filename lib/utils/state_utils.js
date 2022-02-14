'use babel';


export const CODESYNC_STATES = {
    REPO_IS_IN_SYNC: "repoIsInSync",
    USER_EMAIL: "userEmail",
    IS_SUB_DIR: "isSubDir",
    IS_SYNCIGNORED_SUB_DIR: "isSyncIgnored",
    DIFFS_SEND_LOCK_ACQUIRED: "diffsSendLockAcquired",
	POPULATE_BUFFER_LOCK_ACQUIRED: "populateBufferLockAcquired"
}

export class CodeSyncState {

    static set = (key, value) => {
        if (!global.codeSyncState) {
            global.codeSyncState = {};
        }    
        global.codeSyncState[key] = value;
    }
    static get = (key) => {
        if (!global.codeSyncState || !global.codeSyncState[key]) {
            return false;
        }
        return global.codeSyncState[key];
    }
}
