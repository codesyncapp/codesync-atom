'use babel';

import lockFile from 'proper-lockfile';
import { generateSettings } from '../settings';
import { CodeSyncState, CODESYNC_STATES } from './state_utils';


export class LockUtils {
	
	constructor() {
        this.settings = generateSettings();
	}

	checkPopulateBufferLock () {
		try {
			return lockFile.checkSync(this.settings.POPULATE_BUFFER_LOCK_FILE);
		} catch (e) {
			return false;
		}
	}

	checkDiffsSendLock = () => {
		try {
			return lockFile.checkSync(this.settings.DIFFS_SEND_LOCK_FILE);
		} catch (e) {
			return false;
		}
	};
	
	acquirePopulateBufferLock = () => {
		try {
			lockFile.lockSync(this.settings.POPULATE_BUFFER_LOCK_FILE);
			CodeSyncState.set(CODESYNC_STATES.POPULATE_BUFFER_LOCK_ACQUIRED, true);
		} catch (e) {
			// 
		}    
	};
	
	acquireSendDiffsLock = () => {	
		try {
			lockFile.lockSync(this.settings.DIFFS_SEND_LOCK_FILE);
			CodeSyncState.set(CODESYNC_STATES.DIFFS_SEND_LOCK_ACQUIRED, true);
		} catch (e) {
			// 
		}
	};
}



