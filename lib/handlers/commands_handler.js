'use babel';

import fs from "fs";
import yaml from "js-yaml";
import getBranchName from "current-git-branch";

import { redirectToBrowser } from "../utils/auth_utils";
import { showChooseAccount } from "../utils/notifications";
import { repoIsNotSynced } from "../events/utils";
import { initUtils } from "../init/utils";
import { NOTIFICATION } from '../constants';
import { isRepoActive, readYML } from "../utils/common";
import { updateRepo } from "../utils/sync_repo_utils";
import { generateSettings, WEB_APP_URL } from "../settings";

const { shell } = require('electron');

export const SignUpHandler = () => {
	redirectToBrowser();
};

export const SyncHandler = () => {
    const repoPath = atom.project.getPaths()[0];
	if (!repoPath) { return; }
    if (repoIsNotSynced(repoPath) || !!new initUtils(repoPath).successfullySynced(repoPath)) {
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
	const settings = generateSettings();

	const notification = atom.notifications.addWarning(NOTIFICATION.REPO_UNSYNC_CONFIRMATION,  {
		buttons: [
			{
				text: NOTIFICATION.YES,
				onDidClick: async () => {
					const config = readYML(settings.CONFIG_PATH);
					if (!isRepoActive(config, repoPath)) { return; }
					const configRepo = config['repos'][repoPath];
					const users = readYML(settings.USER_PATH);
					const accessToken = users[configRepo.email].access_token;
					const json = await updateRepo(accessToken, configRepo.id, { is_in_sync: false });
					notification.dismiss();
					if (json.error) {
						atom.notifications.addError(NOTIFICATION.REPO_UNSYNC_FAILED);
					} else {
						// Show notification that repo is not in sync
						configRepo.is_disconnected = true;
						fs.writeFileSync(settings.CONFIG_PATH, yaml.safeDump(config));
						// TODO: Maybe should delete repo from .shadow and .originals, can decide later.
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
	const settings = generateSettings();
	const config = readYML(settings.CONFIG_PATH);
	const configRepo = config['repos'][repoPath];
	// Show notification that repo is in sync
	const playbackLink = `${WEB_APP_URL}/repos/${configRepo.id}/playback`;
	shell.openExternal(playbackLink);
}

export const trackFileHandler = () => {
	const repoPath = atom.project.getPaths()[0];
	if (!repoPath) { return; }
	const settings = generateSettings();
	const config = readYML(settings.CONFIG_PATH);
	const configRepo = config['repos'][repoPath];
	atom.workspace.observeTextEditors (function(editor) {
		const filePath = editor.getPath();
		console.log(filePath);
		if (!filePath) { return; }
		const branch = getBranchName({altPath: repoPath}) || DEFAULT_BRANCH;
		const configFiles = configRepo.branches[branch];
		const relPath = filePath.split(`${repoPath}/`)[1];
		if (!(relPath in configFiles )) { return; }
		const fileId = configFiles[relPath];
		// Show notification that repo is in sync
		const playbackLink = `${WEB_APP_URL}/files/${fileId}/history`;
		shell.openExternal(playbackLink);
	})
};
