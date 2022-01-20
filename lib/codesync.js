'use babel';

import { CompositeDisposable } from 'atom';
import { eventHandler } from "./events/event_handler";
import { setupCodeSync } from "./utils/setup_utils";
import {
    SignUpHandler,
    SyncHandler,
    trackFileHandler,
    trackRepoHandler,
    unSyncHandler
} from "./handlers/commands_handler";
import {logout} from "./utils/auth_utils";
import {buttonView, panelView} from "./views";
import {recallDaemon} from "./codesyncd/codesyncd";
import {updateStatusBarItem, checkSubDir} from "./utils/common";
import {generateMenu, generateRightClickMenu} from "./utils/menu_utils";
import {
    DAEMON_MSG_TILE_ID,
    RIGHT_TILE_ID,
    STATUS_BAR_MSGS
} from "./constants";
import { putLogEvent } from "./logger";
import { pathUtils } from "./utils/path_utils";

export default {

    subscriptions: null,

    statusBar: null,

    consumeStatusBar(statusBar) {
        try {
            this.statusBar = statusBar;
            const tiles = statusBar.getRightTiles();
            const rightTiles = tiles.filter(tile => tile.item.id === RIGHT_TILE_ID);
            if (!rightTiles.length) {
                // Add right tile to open right panel
                const buttonViewInstance = new buttonView();
                const view = atom.views.getView(buttonViewInstance);
                const priority = 1;
                statusBar.addRightTile({item: view, priority});
            }
        } catch (e) {
            putLogEvent(e.stack);
        }
    },

    async activate(state) {
        try {
            this.subscriptions = new CompositeDisposable();
            // Drop down menu
            const menu = generateMenu();
            global.menuDisposable = atom.menu.add(menu);

            // right click menu
            const contextMenu = generateRightClickMenu()
            global.contextMenuDisposable = atom.contextMenu.add(contextMenu);

            const panelViewInstance = new panelView();
            // Register a view to change the right panel depending upon the state
            atom.views.addViewProvider(panelViewInstance.getElement);

            // Register commands
            this.subscriptions.add(atom.commands.add('atom-workspace', {
                "CodeSync.SignUp": SignUpHandler
            }));
            this.subscriptions.add(atom.commands.add('atom-workspace', {
                "CodeSync.Logout": logout
            }));
            this.subscriptions.add(atom.commands.add('atom-workspace', {
                "CodeSync.ConnectRepo": SyncHandler
            }));
            this.subscriptions.add(atom.commands.add('atom-workspace', {
                "CodeSync.DisconnectRepo": unSyncHandler
            }));
            this.subscriptions.add(atom.commands.add('atom-workspace', {
                "CodeSync.TrackRepo": trackRepoHandler
            }));
            this.subscriptions.add(atom.commands.add('atom-workspace', {
                "CodeSync.TrackFile": trackFileHandler
            }));

            let repoPath = pathUtils.getProjectPath();

            try {
                await setupCodeSync(repoPath);
            } catch (e) {
                return putLogEvent(e.stack);
            }

            const subDirResult = checkSubDir(repoPath);
            if (repoPath) {
                console.log(`Configured repo: ${repoPath}`);
                if (subDirResult.isSubDir) {
                    repoPath = subDirResult.parentRepo;
                    console.log(`Parent repo: ${repoPath}`);
                }	
            }

            atom.project.onDidChangePaths(async (repoPaths) => {
                for (const _repoPath of repoPaths) {
                    try {
                        await setupCodeSync(_repoPath)
                    } catch (e) {
                        return putLogEvent(e.stack);
                    }
                }
            });

            atom.project.onDidChangeFiles(events => {
                for (const event of events) {
                    // "created", "modified", "deleted", or "renamed"
                    if (event.action === 'created') {
                        try {
                            const handler = new eventHandler(repoPath);
                            handler.handleCreate(event.path);
                        } catch (e) {
                            putLogEvent(e.stack);
                        }
                    }
                    if (event.action === 'deleted') {
                        try {
                            const handler = new eventHandler(repoPath);
                            handler.handleDelete(event.path);
                        } catch (e) {
                            putLogEvent(e.stack);
                        }
                    }
                    if (event.action === 'renamed') {
                        try {
                            const handler = new eventHandler(repoPath);
                            handler.handleRename(event.oldPath, event.path);
                        } catch (e) {
                            putLogEvent(e.stack);
                        }
                    }
                }
            });

            atom.workspace.observeTextEditors(editor => {
                // Register changes handler
                editor.onDidStopChanging(function (event) {
                    try {
                        const handler = new eventHandler(repoPath);
                        handler.handleChangeEvent(editor);
                    } catch (e) {
                        putLogEvent(e.stack);
                    }
                })
            })

            updateStatusBarItem(this.statusBar, STATUS_BAR_MSGS.GETTING_READY);
            recallDaemon(this.statusBar, false);
        } catch (e) {
            putLogEvent(e.stack)
        }
    },

    async deactivate() {
        try {
            // Destroy right tile
            let allRightTiles = this.statusBar.getRightTiles();
            const rightTiles = allRightTiles.filter(tile => tile.item.id === RIGHT_TILE_ID);
            if (rightTiles.length) {
                rightTiles[0].destroy();
            }
            // Destroy left tile
            const allLeftTiles = this.statusBar.getLeftTiles();
            const leftTiles = allLeftTiles.filter(tile => tile.item.id === DAEMON_MSG_TILE_ID);
            if (leftTiles.length) {
                leftTiles[0].destroy();
            }
        } catch (e) {
            putLogEvent(e.stack);
        }
        this.subscriptions.dispose();
    }
};
