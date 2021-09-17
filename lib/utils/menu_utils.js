'use babel';

import { showConnectRepoView, showLogIn } from "./setup_utils";

export const MenuOptions = {
    AUTHENTICATE: {
        "label": "Authenticate",
        "command": "CodeSync.SignUp"
    },
    LOGOUT: {
        "label": "Logout",
        "command": "CodeSync.Logout"
    },
    CONNECT_REPO: {
        "label": "Connect Repo",
        "command": "CodeSync.ConnectRepo"
    },
    DISCONNECT_REPO: {
        "label": "Disconnect Repo",
        "command": "CodeSync.DisconnectRepo"
    },
    REPO_PLAYBACK: {
        "label": "View Repo Playback",
        "command": "CodeSync.TrackRepo"
    },
    FILE_PLAYBACK: {
        "label": "View File Playback",
        "command": "CodeSync.TrackFile"
    }
}

export const generateMenu = () => {
    /*
    * Show Authentication option if not connected with CodeSync
    * Add
    * - Connect/Disconnect repo
    * - View Repo Playback
    * - View File Playback options if a repo is opened in the editor
    * */
    const repoPath = atom.project.getPaths()[0];

    const menu = [
        {
            "label": "Packages",
            "submenu": [
                {
                    "label": "CodeSync",
                    "submenu": []
                }
            ]
        }
    ];
    const menuOptions = menu[0]['submenu'][0]['submenu']
    if (showLogIn()) {
        menuOptions.push(MenuOptions.AUTHENTICATE);
    } else {
        menuOptions.push(MenuOptions.LOGOUT)
        if (repoPath) {
            if (showConnectRepoView()) {
                menuOptions.push(MenuOptions.CONNECT_REPO)
            } else {
                menuOptions.push(MenuOptions.DISCONNECT_REPO)
                menuOptions.push(MenuOptions.REPO_PLAYBACK);
                menuOptions.push(MenuOptions.FILE_PLAYBACK)
            }
        }
    }
    return menu;
};

export const generateRightClickMenu = () => {
    const menu = generateMenu();
    return {
        'atom-text-editor': menu[0]['submenu']
    }
}

export const updateMenu = () => {
    global.menuDisposable.dispose();
    const menu = generateMenu();
    global.menuDisposable = atom.menu.add(menu);
    atom.menu.sortPackagesMenu();
}

export const updateContextMenu = () => {
    global.contextMenuDisposable.dispose();
    const menu = generateRightClickMenu();
    global.contextMenuDisposable = atom.contextMenu.add(menu);
}
