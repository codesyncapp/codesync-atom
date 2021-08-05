'use babel';
import fs from 'fs';
import yaml from 'js-yaml';
import { isPortAvailable, initExpressServer } from "./auth_utils";
import { repoIsNotSynced } from "./event_utils";
import { showSignUpButtons, showConnectRepo } from "./notifications";
import {
	CODESYNC_ROOT, SHADOW_REPO, DIFFS_REPO, ORIGINALS_REPO, NOTIFICATION,
	DELETED_REPO, USER_PATH, Auth0URLs, CONFIG_PATH, SEQUENCE_TOKEN_PATH
} from "../constants";
import { readYML } from './common';
import { initUtils} from "./init_utils";
import {trackRepoHandler, unSyncHandler} from "../commands_handler";


export const setupCodeSync = async (repoPath) => {
	// Create system directories
	const paths = [CODESYNC_ROOT, DIFFS_REPO, ORIGINALS_REPO, SHADOW_REPO, DELETED_REPO];
	paths.forEach((path) => {
		if (!fs.existsSync(path)) {
			// Add file in originals repo
			fs.mkdirSync(path, { recursive: true });
		}
	});

	// Create config.yml if does not exist
	const configExists = fs.existsSync(CONFIG_PATH);
	if (!configExists) {
		fs.writeFileSync(CONFIG_PATH, yaml.safeDump({ repos: {} }));
	}

	// Create sequence_token.yml if does not exist
	const sequenceTokenExists = fs.existsSync(SEQUENCE_TOKEN_PATH);
	if (!sequenceTokenExists) {
		fs.writeFileSync(SEQUENCE_TOKEN_PATH, yaml.safeDump({}));
	}

	let port = 0;
	for (const _port of Auth0URLs.PORTS) {
		const isAvailable = await isPortAvailable(_port);
		if (isAvailable) {
			port = _port;
			break;
		}
	}

	// Set port globally
	global.port = port;

	initExpressServer();

	if (!fs.existsSync(USER_PATH)) {
		showSignUpButtons();
	}

	// Check if access token is present against users
	const users = readYML(USER_PATH) || {};
	const validUsers = [];
	Object.keys(users).forEach(email => {
		const user = users[email];
		if (user.access_token) {
			validUsers.push(email);
		}
	});

	if (validUsers.length === 0) {
		showSignUpButtons();
		return;
	}

	if (!repoPath) { return; }
	// If repo is synced, do not go for Login
	if ((repoIsNotSynced(repoPath) || !initUtils.successfulySynced(repoPath))) {
		// Show notification to user to Sync the repo
		showConnectRepo(repoPath, "", "");
		return;
	}
	// Show notification that repo is connected with CodeSync
	const notification = atom.notifications.addInfo(NOTIFICATION.REPO_IN_SYNC, {
		buttons: [
			{
				text: NOTIFICATION.TRACK_IT,
				onDidClick: trackRepoHandler
			},
			{
				text: NOTIFICATION.UNSYNC_REPO,
				onDidClick: () => {
					notification.dismiss();
					unSyncHandler();
				}
			}

		],
		dismissable: true
	});
};

export const showLogIn = () => {
	if (!fs.existsSync(USER_PATH)) {
		return true;
	}

	// Check if access token is present against users
	const users = readYML(USER_PATH) || {};
	const validUsers = [];
	Object.keys(users).forEach(email => {
		const user = users[email];
		if (user.access_token) {
			validUsers.push(email);
		}
	});

	return validUsers.length === 0;
};

export const showConnectRepoView = () => {
	const repoPath = atom.project.getPaths()[0];
	if (!repoPath) { return false; }
	return repoIsNotSynced(repoPath) || !initUtils.successfulySynced(repoPath);
};
