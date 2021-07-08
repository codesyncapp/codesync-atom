'use babel';

import { redirectToBrowser } from "./utils/login_utils";
import { showChooseAccount } from "./utils/notifications";
import { repoIsNotSynced } from "./utils/event_utils";
import { initUtils } from "./utils/init_utils";
import { NOTIFICATION } from './constants';

export const SignUpHandler = () => {
	redirectToBrowser();
};

export const SyncHandler = () => {
    const repoPath = atom.project.getPaths()[0];
	if (!repoPath) { return; }
    if (repoIsNotSynced(repoPath) || !initUtils.successfulySynced(repoPath)) { 
		// Show notification to user to choose acount
		showChooseAccount(repoPath);
		return;
	} 
	// Show notification that repo is in sync
	atom.notifications.addInfo(NOTIFICATION.REPO_IN_SYNC);
};

export const unSyncHandler = () => {
	console.log("Unsync activated");
};