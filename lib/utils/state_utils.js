'use babel';


export const CODESYNC_STATES = {
    REPO_IS_IN_SYNC: "repoIsInSync",
    USER_EMAIL: "userEmail"
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
        return true;
    }
}
