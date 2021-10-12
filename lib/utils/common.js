'use babel';

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import getBranchName from "current-git-branch";
import {
    DAEMON_MSG_TILE_ID,
    DEFAULT_BRANCH,
    IGNORABLE_DIRECTORIES,
    SYNCIGNORE
} from "../constants";
import { daemonMessages } from "../views";

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
