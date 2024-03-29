'use babel';

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

import { isBinaryFileSync } from "isbinaryfile";
import { putLogEvent } from "../logger";
import { uploadFileToServer } from "../utils/upload_utils";
import { diff_match_patch } from "diff-match-patch";

import {
	DAEMON_MSG_TILE_ID,
	DIFF_SIZE_LIMIT,
	STATUS_BAR_MSGS,
	REQUIRED_DIFF_KEYS,
	REQUIRED_DIR_RENAME_DIFF_KEYS,
	REQUIRED_FILE_RENAME_DIFF_KEYS,
} from "../constants";
import { generateSettings } from "../settings";
import { pathUtils } from "../utils/path_utils";
import { readYML, getActiveUsers, checkSubDir, isRepoActive} from "../utils/common";
import { daemonMessages } from "../views";


export const isValidDiff = (diffData) => {
	const missingKeys = REQUIRED_DIFF_KEYS.filter(key => !(key in diffData));
	if (missingKeys.length) { return false; }
	const isRename = diffData.is_rename;
	const isDirRename = diffData.is_dir_rename;
	const diff = diffData.diff;
	if (diff && diff.length > DIFF_SIZE_LIMIT) { return false; }
	if (isRename || isDirRename) {
		if (!diff) { return false; }
		let diffJSON = {};
		diffJSON = yaml.load(diff);
		if (typeof diffJSON !== "object") {
			return false;
		}
		if (isRename && isDirRename) {
			return false;
		}
		if (isRename) {
			const missingRenameKeys = REQUIRED_FILE_RENAME_DIFF_KEYS.filter(key => !(key in diffJSON));
			if (missingRenameKeys.length) { return false; }
		}
		if (isDirRename) {
			const missingDirRenameKeys = REQUIRED_DIR_RENAME_DIFF_KEYS.filter(key => !(key in diffJSON));
			if (missingDirRenameKeys.length) { return false; }
		}
	}
	return true;
};

export const handleNewFileUpload = async (accessToken, repoPath, branch, createdAt, relPath, repoId, configJSON) => {
	/*
	Uploads new file to server and adds it in config
	Ignore if file is not present in .originals repo
	*/
	const settings = generateSettings();
	const pathUtilsObj = new pathUtils(repoPath, branch);
	const originalsFilePath = path.join(pathUtilsObj.getOriginalsRepoBranchPath(), relPath);
	if (!fs.existsSync(originalsFilePath)) {
		return {
			uploaded: false,
			config: configJSON
		};
	}
	const response = await uploadFileToServer(accessToken, repoId, branch, originalsFilePath,
		relPath, createdAt);
	if (response.error) {
		putLogEvent(`Error uploading file to server: ${response.error}`);
		return {
			uploaded: false,
			config: configJSON
		};
	}
	configJSON.repos[repoPath].branches[branch][relPath] = response.fileId;
	// write file id to config.yml
	fs.writeFileSync(settings.CONFIG_PATH, yaml.safeDump(configJSON));
	// Delete file from .originals
	if (fs.existsSync(originalsFilePath)) {
		fs.unlinkSync(originalsFilePath);
	}
	return {
		uploaded: true,
		config: configJSON
	};
};

export const cleanUpDeleteDiff = (repoPath, branch, relPath, configJSON) => {
	const settings = generateSettings();
	const pathUtilsObj = new pathUtils(repoPath, branch);
	const shadowPath = path.join(pathUtilsObj.getShadowRepoBranchPath(), relPath);
	const originalsPath = path.join(pathUtilsObj.getOriginalsRepoBranchPath(), relPath);
	const cacheFilePath = path.join(pathUtilsObj.getDeletedRepoBranchPath(), relPath);
	[shadowPath, originalsPath, cacheFilePath].forEach((path) => {
		if (fs.existsSync(path)) {
			fs.unlinkSync(path);
		}
	});
	delete configJSON.repos[repoPath].branches[branch][relPath];
	// write file id to config.yml
	fs.writeFileSync(settings.CONFIG_PATH, yaml.safeDump(configJSON));
};

export const getDIffForDeletedFile = (repoPath, branch, relPath, configJSON) => {
	let diff = "";
	const pathUtilsObj = new pathUtils(repoPath, branch);
	const shadowPath = path.join(pathUtilsObj.getShadowRepoBranchPath(), relPath);
	if (!fs.existsSync(shadowPath)) {
		cleanUpDeleteDiff(repoPath, branch, relPath, configJSON);
		return diff;
	}
	// See if shadow file can be read
	const isBinary = isBinaryFileSync(shadowPath);
	if (isBinary) {
		cleanUpDeleteDiff(repoPath, branch, relPath, configJSON);
		return diff;
	}
	const shadowText = fs.readFileSync(shadowPath, "utf8");
	const dmp = new diff_match_patch();
	const patches = dmp.patch_make(shadowText, "");
	diff = dmp.patch_toText(patches);
	cleanUpDeleteDiff(repoPath, branch, relPath, configJSON);
	return diff;
};

export const similarity = (s1, s2) => {
	let longer = s1;
	let shorter = s2;
	if (s1.length < s2.length) {
		longer = s2;
		shorter = s1;
	}
	const longerLength = longer.length;
	if (longerLength === 0) {
		return 1.0;
	}
	return (longerLength - editDistance(longer, shorter)) / longerLength;
};

const editDistance = (s1, s2) => {
	s1 = s1.toLowerCase();
	s2 = s2.toLowerCase();

	const costs = [];
	for (let i = 0; i <= s1.length; i++) {
		let lastValue = i;
		for (let j = 0; j <= s2.length; j++) {
			if (i === 0)
				costs[j] = j;
			else {
				if (j > 0) {
					let newValue = costs[j - 1];
					if (s1.charAt(i - 1) !== s2.charAt(j - 1))
						newValue = Math.min(Math.min(newValue, lastValue),
							costs[j]) + 1;
					costs[j - 1] = lastValue;
					lastValue = newValue;
				}
			}
		}
		if (i > 0)
			costs[s2.length] = lastValue;
	}
	return costs[s2.length];
};

export class statusBarMsgs {
	/*
		Handles status bar msgs from daemon
	*/

	constructor(statusBarItem) {
		this.statusBarItem = statusBarItem;
		this.settings = generateSettings();
		this.configJSON = readYML(this.settings.CONFIG_PATH);
	}

	update = (text) => {
		try {
			const tiles = this.statusBarItem.getLeftTiles();
			const daemonMsgTiles = tiles.filter(tile => tile.item.id === DAEMON_MSG_TILE_ID);
			const daemonMsgView = new daemonMessages({ text });
			const view = atom.views.getView(daemonMsgView);
			const priority = 1;
	
			if (!daemonMsgTiles.length) {
				this.statusBarItem.addLeftTile({ item: view, priority });
				return;
			}
	
			if (daemonMsgTiles[0].item.textContent !== `${text}`) {
				daemonMsgTiles[0].destroy();
				this.statusBarItem.addLeftTile({ item: view, priority });
			}
		} catch (e) {
			putLogEvent(e.stack);
		}
	};

	getMsg = () => {
		if (!fs.existsSync(this.settings.CONFIG_PATH)) return STATUS_BAR_MSGS.NO_CONFIG;
		const repoPath = pathUtils.getProjectPath();
		const activeUsers = getActiveUsers();
		// No Valid account found
		if (!activeUsers.length) return STATUS_BAR_MSGS.AUTHENTICATION_FAILED;
		// No repo is opened
		if (!repoPath) return STATUS_BAR_MSGS.NO_REPO_OPEN;
		const subDirResult = checkSubDir(repoPath);
		if (subDirResult.isSubDir) {
			if (subDirResult.isSyncIgnored) {
				return STATUS_BAR_MSGS.IS_SYNCIGNORED_SUB_DIR;
			}
			return STATUS_BAR_MSGS.DEFAULT;	
		}
		// Repo is not synced
		if (!isRepoActive(this.configJSON, repoPath)) return STATUS_BAR_MSGS.CONNECT_REPO;
		return STATUS_BAR_MSGS.DEFAULT;
	}
}