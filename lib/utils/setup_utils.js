'use babel';

import fs from 'fs';
import yaml from 'js-yaml';
import { isPortAvailable } from "./auth_utils";
import { repoIsNotSynced } from "../events/utils";
import { showSignUpButtons, showConnectRepo } from "./notifications";
import {
	NOTIFICATION,
	Auth0URLs,
	getRepoInSyncMsg
} from "../constants";
import { readYML } from './common';
import { initUtils } from "../init/utils";
import { trackRepoHandler } from "../handlers/commands_handler";
import { generateSettings } from "../settings";
import { initExpressServer } from "../server/server";


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

export const setupCodeSync = async (repoPath) => {
	// Create system directories
	const settings = createSystemDirectories();

	let port = 0;
	for (const _port of Auth0URLs.PORTS) {
		const isAvailable = await isPortAvailable(_port);
		if (isAvailable) {
			port = _port;
			break;
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

	// Check if access token is present against users
	const users = readYML(settings.USER_PATH) || {};
	const validUsers = [];
	Object.keys(users).forEach(email => {
		const user = users[email];
		if (user.access_token) {
			validUsers.push(email);
		}
	});

	if (validUsers.length === 0) {
		showSignUpButtons();
		return port;
	}

	if (!repoPath) { return; }
	// If repo is synced, do not go for Login
	if ((repoIsNotSynced(repoPath) || !new initUtils(repoPath).successfullySynced())) {
		// Show notification to user to Sync the repo
		showConnectRepo(repoPath, "", "");
		return port;

	}
	// Show notification that repo is connected with CodeSync
	const notification = atom.notifications.addInfo(getRepoInSyncMsg(repoPath), {
		buttons: [
			{
				text: NOTIFICATION.TRACK_IT,
				onDidClick: trackRepoHandler
			}
		],
		dismissable: true
	});
};

export const showLogIn = () => {
	const settings = generateSettings();
	if (!fs.existsSync(settings.USER_PATH)) {
		return true;
	}

	// Check if access token is present against users
	const users = readYML(settings.USER_PATH) || {};
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
	return repoIsNotSynced(repoPath) || !new initUtils(repoPath).successfullySynced();
};
