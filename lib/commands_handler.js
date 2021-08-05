'use babel';

import { redirectToBrowser } from "./utils/auth_utils";
import { showChooseAccount } from "./utils/notifications";
import { repoIsNotSynced } from "./utils/event_utils";
import { initUtils } from "./utils/init_utils";
import { CONFIG_PATH, NOTIFICATION, WEB_APP_URL } from './constants';
import { readYML } from "./utils/common";
const { shell } = require('electron');

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

export const trackRepoHandler = () => {
	const repoPath = atom.project.getPaths()[0];
	if (!repoPath) { return; }
	const config = readYML(CONFIG_PATH);
	const configRepo = config['repos'][repoPath];
	// Show notification that repo is in sync
	const playbackLink = `${WEB_APP_URL}/repos/${configRepo.id}/playback`;
	shell.openExternal(playbackLink);
}
