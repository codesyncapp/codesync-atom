'use babel';

import fs from 'fs';
import yaml from 'js-yaml';
import {
	getRepoInSyncMsg,
	getDirectoryIsSyncedMsg,
	MAX_PORT,
	MIN_PORT,
	NOTIFICATION,
	SYNCIGNORE
} from "../constants";
import { isPortAvailable } from "./auth_utils";
import { isRepoSynced } from "../events/utils";
import { showConnectRepo, showSignUpButtons, showSyncIgnoredRepo } from './notifications';
import { checkSubDir, getActiveUsers } from './common';
import { trackRepoHandler } from "../handlers/commands_handler";
import { generateSettings } from "../settings";
import { initExpressServer } from "../server/server";
import { CodeSyncState, CODESYNC_STATES } from "./state_utils";


export const createSystemDirectories = () => {
	const settings = generateSettings();
	// Create system directories
	const paths = [
		settings.CODESYNC_ROOT,
		settings.DIFFS_REPO,
		settings.ORIGINALS_REPO,
		settings.SHADOW_REPO,
		settings.DELETED_REPO,
	];

	paths.forEach((path) => {
		if (!fs.existsSync(path)) {
			// Add file in originals repo
			fs.mkdirSync(path, { recursive: true });
		}
	});
	const configPath = settings.CONFIG_PATH;
	const sequenceTokenPath = settings.SEQUENCE_TOKEN_PATH;
	// Create config.yml if does not exist
	const configExists = fs.existsSync(configPath);
	if (!configExists) {
		fs.writeFileSync(configPath, yaml.safeDump({ repos: {} }));
	}

	// Create sequence_token.yml if does not exist
	const sequenceTokenExists = fs.existsSync(sequenceTokenPath);
	if (!sequenceTokenExists) {
		fs.writeFileSync(sequenceTokenPath, yaml.safeDump({}));
	}
	return settings;
};

const generateRandom = (min = 0, max = 100)  => {
	// find diff
	const difference = max - min;
	// generate random number
	let rand = Math.random();
	// multiply with difference
	rand = Math.floor( rand * difference);
	// add with min value
	rand = rand + min;
	return rand;
};

export const setupCodeSync = async (repoPath) => {
	// Create system directories
	const settings = createSystemDirectories();

	let port = 0;
	while (!port) {
		const randomPort = generateRandom(MIN_PORT, MAX_PORT);
		const isAvailable = await isPortAvailable(randomPort);
		if (isAvailable) {
			port = randomPort;
		}
	}

	if (!global.port) {
		// Set port globally
		global.port = port;
		initExpressServer();
	}

	if (!fs.existsSync(settings.USER_PATH)) {
		showSignUpButtons();
		return port;
	}

	// Check if there is valid user present
	const validUsers = getActiveUsers();

	if (validUsers.length === 0) {
		showSignUpButtons();
		return port;
	}

	return showRepoStatusMsg(repoPath, port);

};

export const showRepoStatusMsg = (repoPath, port=null) => {

	if (!repoPath) return;

	const subDirResult = checkSubDir(repoPath);

	registerSyncIgnoreSaveEvent(repoPath);

	if (showRepoIsSyncIgnoredView(repoPath)) {
		showSyncIgnoredRepo(repoPath, subDirResult.parentRepo);
		return port;
	}
	
	// If repo is synced, do not go for Login
	if (showConnectRepoView(repoPath)) {
		// Show notification to user to Sync the repo
		showConnectRepo(repoPath);
		return port;
	}

	let msg = getRepoInSyncMsg(repoPath);
	let buttonText = NOTIFICATION.TRACK_IT;
	let detail;

	if (subDirResult.isSubDir) {
		buttonText = NOTIFICATION.TRACK_PARENT_REPO;
		const json = getDirectoryIsSyncedMsg(repoPath, subDirResult.parentRepo);
		msg = json.msg;
		detail = json.detail;
	}

	// Show notification that repo is connected with CodeSync
	atom.notifications.addInfo(msg, {
		buttons: [
			{
				text: buttonText,
				onDidClick: trackRepoHandler
			}
		],
		dismissable: true,
		detail
	});
}
export const showLogIn = () => {
	const settings = generateSettings();
	if (!fs.existsSync(settings.USER_PATH)) {
		return true;
	}
	const validUsers = getActiveUsers();
	const userEmail = validUsers.length === 0 ? null : validUsers[0].email;
	CodeSyncState.set(CODESYNC_STATES.USER_EMAIL, userEmail);
	return !userEmail;
};

export const showConnectRepoView = (repoPath) => {
	if (!repoPath) { return false; }
	const repoIsSynced = isRepoSynced(repoPath);
	CodeSyncState.set(CODESYNC_STATES.REPO_IS_IN_SYNC, repoIsSynced);
	return !repoIsSynced;
};

export const showRepoIsSyncIgnoredView = (repoPath) => {
	if (!repoPath) return false;
	const result = checkSubDir(repoPath);
	CodeSyncState.set(CODESYNC_STATES.IS_SUB_DIR, result.isSubDir);
	CodeSyncState.set(CODESYNC_STATES.IS_SYNCIGNORED_SUB_DIR, result.isSyncIgnored);
	return result.isSubDir && result.isSyncIgnored;
};

const registerSyncIgnoreSaveEvent = (repoPath) => {
	atom.workspace.observeTextEditors(editor => {
		editor.onDidSave((event) => {
			if (!event.path.endsWith(SYNCIGNORE)) return;
			showRepoStatusMsg(repoPath);
		})
	})
};
