'use babel';

import fs from "fs";
import yaml from "js-yaml";

import { redirectToBrowser } from "./utils/auth_utils";
import { showChooseAccount } from "./utils/notifications";
import { repoIsNotSynced } from "./utils/event_utils";
import { initUtils } from "./utils/init_utils";
import { CONFIG_PATH, NOTIFICATION, USER_PATH, WEB_APP_URL } from './constants';
import { readYML } from "./utils/common";
import { updateRepo } from "./utils/sync_repo_utils";

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
	const repoPath = atom.project.getPaths()[0];
	if (!repoPath) { return; }

	const notification = atom.notifications.addWarning(NOTIFICATION.REPO_UNSYNC_CONFIRMATION,  {
		buttons: [
			{
				text: NOTIFICATION.YES,
				onDidClick: async () => {
					const config = readYML(CONFIG_PATH);
					if (!(repoPath in config['repos'])) { return; }
					const configRepo = config['repos'][repoPath];
					const users = readYML(USER_PATH);
					const accessToken = users[configRepo.email].access_token;
					const json = await updateRepo(accessToken, configRepo.id, { is_in_sync: false });
					console.log("Done", json)
					notification.dismiss();
					if (json.error) {
						atom.notifications.addError(NOTIFICATION.REPO_UNSYNC_FAILED);
					} else {
						// Show notification that repo is not in sync
						delete config['repos'][repoPath];
						fs.writeFileSync(CONFIG_PATH, yaml.safeDump(config));
						atom.notifications.addInfo(NOTIFICATION.REPO_UNSYNCED);
					}
				}
			},
			{
				text: NOTIFICATION.CANCEL,
				onDidClick: () => notification.dismiss()
			}
		],
		dismissable: true
	})
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
