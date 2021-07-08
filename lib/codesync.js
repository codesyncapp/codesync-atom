'use babel';

import fs from 'fs';
import yaml from 'js-yaml';
import { handleBuffer } from './buffer_handler';
import { CompositeDisposable } from 'atom';
import { CONFIG_PATH, COMMAND } from "./constants";
import { handleChanges, handleFileCreated, handleFileDeleted,
  handleFileRenamed } from "./event_handler";
import { setupCodeSync } from "./utils/setup_utils";
import { SignUpHandler, SyncHandler, unSyncHandler } from "./commands_handler";

// export default class MyPackageView {
//     constructor(serializedState) {
//       // Create root element
//       this.element = document.createElement('div');
//       this.element.classList.add('my-package');
//
//       // Create message element
//       const message = document.createElement('div');
//       message.textContent = 'The MyPackage package is Alive! It\'s ALIVE!';
//       message.classList.add('message');
//       this.element.appendChild(message);
//     }
//
//     getElement() {
//       console.log('element: ', this.element);
//       return this.element;
//     }
// }
//
// function myView(model) {
//   // create a new div element
//   const newDiv = document.createElement("div");
//   // and give it some content
//   const newContent = document.createTextNode("Hi there and greetings!");
//   // add the text node to the newly created div
//   newDiv.appendChild(newContent);
//   return newDiv;
// }

export default {

  subscriptions: null,

  async activate(state) {
    
    // let myPackageView = new MyPackageView();
    // let modalPanel = atom.workspace.addBottomPanel({
    //   item: myPackageView.getElement(),
    //   visible: true
    // });
    //
    // modalPanel.show();
    // const view  = atom.views.addViewProvider(myView);
    // this.subscriptions.add(view);
    // const panel = atom.workspace.addTopPanel({ item: view });

    // Register commands
    this.subscriptions = new CompositeDisposable();
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      "CodeSync:Sign Up": () => SignUpHandler()
    }));
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      "CodeSync:Sync": () => SyncHandler()
    }));
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      "CodeSync:Unsync": () => unSyncHandler()
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
