'use babel';

import fs from 'fs';
import yaml from 'js-yaml';
import { DAEMON_MSG_TILE_ID, STATUS_BAR_MSGS } from "../constants";
import { daemonMessages } from "../views";

export const readFile = (filePath) => {
	return fs.readFileSync(filePath, "utf8");
};

export const readYML = (filePath) => {
    try {
        return yaml.load(readFile(filePath));
    } catch (e) {
        return {};
    }
};

export const updateStatusBarItem = (statusBar, text= STATUS_BAR_MSGS.DEFAULT) => {
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

export const isRepoActive = (config, repoPath) => {
    return repoPath in config.repos && !config.repos[repoPath].is_disconnected;
}
