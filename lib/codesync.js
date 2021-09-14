'use babel';

import fs from 'fs';
import yaml from 'js-yaml';
import { CompositeDisposable } from 'atom';
import { STATUS_BAR_MSGS } from "./constants";
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
import { buttonView, panelView } from "./views";
import { updateStatusBarItem } from "./utils/common";
import { handleBuffer } from "./codesyncd/buffer_handler";
import { detectBranchChange } from "./codesyncd/populate_buffer";
import { generateSettings } from "./settings";


export default {

  subscriptions: null,

  statusBar: null,

  consumeStatusBar(statusBar) {
    this.statusBar = statusBar;
    // Add right tile to open right panel
    const buttonViewInstance = new buttonView();
    const view = atom.views.getView(buttonViewInstance);
    const priority = 1;
    statusBar.addRightTile({ item: view, priority });
  },

  async activate(state) {
    const panelViewInstance = new panelView();
    // Register a view to change the right panel depending upon the state
    atom.views.addViewProvider(panelViewInstance.getElement);

    this.subscriptions = new CompositeDisposable();

    // Register commands
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      "CodeSync: Sign Up": () => SignUpHandler()
    }));
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      "CodeSync: Connect Repo": () => SyncHandler()
    }));
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      "CodeSync: Disconnect Repo": () => unSyncHandler()
    }));
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      "codesync.trackRepo": () => trackRepoHandler()
    }));
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      "codesync.trackFile": () => trackFileHandler()
    }));


    this.subscriptions.add(atom.contextMenu.add({'atom-text-editor': [{
        label: 'CodeSync',
        submenu: [{
          label: 'View File Playback',
          command: "codesync.trackFile"
        }]
      }]
    }));

    const repoPath = atom.project.getPaths()[0];

    await setupCodeSync(repoPath);

    atom.project.onDidChangePaths(async (repoPaths) => {
      for (const repoPath of repoPaths) {
        await setupCodeSync(repoPath)
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

    atom.workspace.observeTextEditors (function(editor) {
      if (!repoPath) { return; }
      // TODO: Show some alert to user
      // If config.yml does not exists, return
      const settings = generateSettings();

      const configExists = fs.existsSync(settings.CONFIG_PATH);
      if (!configExists) { return; }
      // Return if user hasn't synced the repo
      try {
        const config = yaml.load(fs.readFileSync(settings.CONFIG_PATH, "utf8"));
        if (!(repoPath in config['repos'])) {
          console.log("Skipping non-synced repo")
          return;
        }
      } catch (e) {
        return;
      }
      // Register changes handler
      editor.onDidStopChanging(function(event) {
        handleChanges(editor);
      })
    })
    await detectBranchChange();
    updateStatusBarItem(this.statusBar, STATUS_BAR_MSGS.GETTING_READY);
    await handleBuffer(this.statusBar);
  },

  deactivate() {
    this.subscriptions.dispose();
  }
};
