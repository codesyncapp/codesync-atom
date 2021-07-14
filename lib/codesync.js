'use babel';

import fs from 'fs';
import yaml from 'js-yaml';
import { handleBuffer } from './buffer_handler';
import { CompositeDisposable } from 'atom';
import { CONFIG_PATH } from "./constants";
import { handleChanges, handleFileCreated, handleFileDeleted,
  handleFileRenamed } from "./event_handler";
import { setupCodeSync } from "./utils/setup_utils";
import { SignUpHandler, SyncHandler, unSyncHandler } from "./commands_handler";
import { buttonView, panelView } from "./views";

export default {

  subscriptions: null,

  consumeStatusBar(statusBar) {
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
      "CodeSync: Connet Repo": () => SyncHandler()
    }));
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      "CodeSync: Disconnect Repo": () => unSyncHandler()
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
      const repoName = repoPath.split('/').pop();
      // TODO: Show some alert to user
      // If config.yml does not exists, return
      const configExists = fs.existsSync(CONFIG_PATH);
      if (!configExists) { return; }
      // Return if user hasn't synced the repo
      try {
        const config = yaml.load(fs.readFileSync(CONFIG_PATH, "utf8"));
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

    handleBuffer();
  },

  deactivate() {
    this.subscriptions.dispose();
  }
};
