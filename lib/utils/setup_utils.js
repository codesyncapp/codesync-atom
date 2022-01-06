'use babel';

import fs from 'fs';
import yaml from 'js-yaml';
import { isPortAvailable } from "./auth_utils";
import { isRepoSynced } from "../events/utils";
import { showSignUpButtons, showConnectRepo } from "./notifications";
import {
	getRepoInSyncMsg,
	MIN_PORT,
	MAX_PORT,
	NOTIFICATION
} from "../constants";
import { getActiveUsers, getProjectPath } from './common';
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

	if (!repoPath) { return; }
	// If repo is synced, do not go for Login
	if ((!isRepoSynced(repoPath) || !new initUtils(repoPath).successfullySynced())) {
		// Show notification to user to Sync the repo
		showConnectRepo(repoPath);
		return port;

	}
	// Show notification that repo is connected with CodeSync
	atom.notifications.addInfo(getRepoInSyncMsg(repoPath), {
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
	const validUsers = getActiveUsers();
	return validUsers.length === 0;
};

export const showConnectRepoView = () => {
	const repoPath = getProjectPath();
	if (!repoPath) { return false; }
	return !isRepoSynced(repoPath) || !new initUtils(repoPath).successfullySynced();
};
