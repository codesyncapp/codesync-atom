'use babel';

import {CompositeDisposable} from 'atom';
import {DAEMON_MSG_TILE_ID, RIGHT_TILE_ID, STATUS_BAR_MSGS} from "./constants";
import {
    handleChanges,
    handleFileCreated,
    handleFileDeleted,
    handleFileRenamed
} from "./events/event_handler";
import { setupCodeSync } from "./utils/setup_utils";
import {
    SignUpHandler,
    SyncHandler,
    trackFileHandler,
    trackRepoHandler,
    unSyncHandler
} from "./handlers/commands_handler";
import {buttonView, panelView} from "./views";
import {updateStatusBarItem} from "./utils/common";
import {handleBuffer} from "./codesyncd/buffer_handler";
import {detectBranchChange} from "./codesyncd/populate_buffer";
import {generateMenu, generateRightClickMenu} from "./utils/menu_utils";
import {logout} from "./utils/auth_utils";


export default {

    subscriptions: null,

    statusBar: null,

    consumeStatusBar(statusBar) {
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
    },

    async activate(state) {
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
            "CodeSync.SignUp": () => SignUpHandler()
        }));
        this.subscriptions.add(atom.commands.add('atom-workspace', {
            "CodeSync.Logout": () => logout()
        }));
        this.subscriptions.add(atom.commands.add('atom-workspace', {
            "CodeSync.ConnectRepo": () => SyncHandler()
        }));
        this.subscriptions.add(atom.commands.add('atom-workspace', {
            "CodeSync.DisconnectRepo": () => unSyncHandler()
        }));
        this.subscriptions.add(atom.commands.add('atom-workspace', {
            "CodeSync.TrackRepo": () => trackRepoHandler()
        }));
        this.subscriptions.add(atom.commands.add('atom-workspace', {
            "CodeSync.TrackFile": () => trackFileHandler()
        }));

        const repoPath = atom.project.getPaths()[0];

        await setupCodeSync(repoPath);

        atom.project.onDidChangePaths(async (repoPaths) => {
            for (const _repoPath of repoPaths) {
                await setupCodeSync(_repoPath)
            }
        });

        atom.project.onDidChangeFiles(events => {
            for (const event of events) {
                // "created", "modified", "deleted", or "renamed"
                if (event.action === 'created') {
                    handleFileCreated(event);
                    return;
                }
                if (event.action === 'deleted') {
                    handleFileDeleted(event);
                    return;
                }
                if (event.action === 'renamed') {
                    handleFileRenamed(event);
                    return;
                }
            }
        });

        atom.workspace.observeTextEditors(function (editor) {
            // Register changes handler
            editor.onDidStopChanging(function (event) {
                handleChanges(editor);
            })
        })
        await detectBranchChange();
        updateStatusBarItem(this.statusBar, STATUS_BAR_MSGS.GETTING_READY);
        await handleBuffer(this.statusBar);
    },

    async deactivate() {
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
        this.subscriptions.dispose();
    }
};
