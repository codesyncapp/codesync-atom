'use babel';

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import dateFormat from "dateformat";
import getBranchName from "current-git-branch";
import {
    DAEMON_MSG_TILE_ID,
    DATETIME_FORMAT,
    DEFAULT_BRANCH,
    IGNORABLE_DIRECTORIES,
    LOG_AFTER_X_TIMES,
    SYNCIGNORE
} from "../constants";
import { daemonMessages } from "../views";
import { generateSettings } from "../settings";
import { putLogEvent } from "../logger";
import { shouldIgnorePath } from '../events/utils';


export const readFile = (filePath) => {
	return fs.readFileSync(filePath, "utf8");
};

export const readYML = (filePath) => {
    try {
        return yaml.load(readFile(filePath));
    } catch (e) {
        return null;
    }
};

export const updateStatusBarItem = (statusBar, text) => {
    try {
        const tiles = statusBar.getLeftTiles();
        const daemonMsgTiles = tiles.filter(tile => tile.item.id === DAEMON_MSG_TILE_ID);
        const daemonMsgView = new daemonMessages({ text });
        const view = atom.views.getView(daemonMsgView);
        const priority = 1;

        if (!daemonMsgTiles.length) {
            statusBar.addLeftTile({ item: view, priority });
            return;
        }

        if (daemonMsgTiles[0].item.textContent !== `${text}`) {
            daemonMsgTiles[0].destroy();
            statusBar.addLeftTile({ item: view, priority });
        }
    } catch (e) {
        putLogEvent(e.stack);
    }
};

export const checkSubDir = (currentRepoPath) => {
	const settings = generateSettings();
	const configPath = settings.CONFIG_PATH;
	let isSyncIgnored = false;
	// If config.yml does not exist, return
	if (!fs.existsSync(configPath)) return {
		isSubDir: false,
		parentRepo: "",
		isSyncIgnored
	};
	let config;
	try {
		config = readYML(configPath);
	} catch (e) {
		return {
			isSubDir: false,
			parentRepo: "",
			isSyncIgnored
		};
	}

	const repoPaths = Object.keys(config.repos);
	let parentRepo = "";
	repoPaths.forEach(_repoPath => {
		const relative = path.relative(_repoPath, currentRepoPath);
		const isSubdir = relative && !relative.startsWith('..') && !path.isAbsolute(relative);
		if (isSubdir) {
			parentRepo = _repoPath;
			const relPath = currentRepoPath.split(path.join(_repoPath, path.sep))[1];
			isSyncIgnored = shouldIgnorePath(_repoPath, relPath);
			return _repoPath;
		}
	});

	return {
		isSubDir: !!parentRepo,
		parentRepo,
		isSyncIgnored
	};
};

export const getSyncIgnoreItems = (repoPath) => {
    const syncIgnorePath = path.join(repoPath, SYNCIGNORE);
    const syncIgnoreExists = fs.existsSync(syncIgnorePath);
    if (!syncIgnoreExists) {
        return [];
    }
    let syncIgnoreData = "";
    syncIgnoreData = readFile(syncIgnorePath);
    const syncIgnoreItems = syncIgnoreData.split("\n");
    return syncIgnoreItems.filter(item =>  item);
};

export const getSkipRepos = (repoPath, syncignoreItems) => {
    const skipRepos = [...IGNORABLE_DIRECTORIES];
    syncignoreItems.forEach((pattern) => {
        const itemPath = path.join(repoPath, pattern);
        if (!fs.existsSync(itemPath)) { return; }
        const lstat = fs.lstatSync(itemPath);
        if (lstat.isDirectory()) {
            skipRepos.push(pattern);
        }
    });
    return skipRepos;
};

export const isEmpty = (obj) => {
    return Object.keys(obj).length === 0;
}

export const getBranch = (repoPath) => {
    return getBranchName({ altPath: repoPath }) || DEFAULT_BRANCH;
};

export const isRepoActive = (config, repoPath) => {
    return repoPath in config.repos && !config.repos[repoPath].is_disconnected &&
        !isEmpty(config.repos[repoPath].branches) && Boolean(config.repos[repoPath].email);
}

export const formatDatetime = (datetime) => {
    if (datetime) {
        return dateFormat(new Date(datetime), DATETIME_FORMAT);
    }
    return dateFormat(new Date(), DATETIME_FORMAT);
};

export const isUserActive = (user) => {
    const isActive = 'is_active' in user ? user.is_active : true;
    return isActive && "access_token" in user && user.access_token !== "";
};

export const getActiveUsers = () => {
    const settings = generateSettings();
    const users = readYML(settings.USER_PATH) || {};
    const validUsers = [];
    Object.keys(users).forEach(email => {
        const user = users[email];
        if (isUserActive(user)) {
            validUsers.push({ email, access_token: user.access_token });
        }
    });
    return validUsers;
};

export const logMsg = (msg, errCount) => {
    if (errCount === 0 || errCount > LOG_AFTER_X_TIMES) {
        putLogEvent(msg);
    }
    if (errCount > LOG_AFTER_X_TIMES) {
        errCount = 0;
        return errCount;
    }
    errCount += 1;
    return errCount;
};

