'use babel';

import fs from 'fs';
import yaml from 'js-yaml';

import { diff_match_patch } from 'diff-match-patch';
import getBranchName from 'current-git-branch';
import dateFormat from "dateformat";

import { CODESYNC_ROOT, DIFFS_REPO, CONFIG_PATH, DIFF_SOURCE, DEFAULT_BRANCH } from "./constants";
import { handleFileCreated, handleFileDeleted, handleChanges, handleFileRenamed } from "./utils";

export default {

  subscriptions: null,

  activate(state) {
    atom.project.onDidChangeFiles(events => {
      const repoPath = atom.project.getPaths()[0];
      const repoName = repoPath.split('/').pop();
      const branch = getBranchName({ altPath: repoPath });

      for (const event of events) {
        // "created", "modified", "deleted", or "renamed"
        if (event.action === 'created') {
          handleFileCreated(event, repoPath, repoName, branch);
        }
        if (event.action === 'deleted') {
          handleFileDeleted(event, repoPath, repoName, branch);
        }

        if (event.action === 'renamed') {
          handleFileRenamed(event, repoPath, repoName, branch);
        }
      }
    });

    atom.workspace.observeTextEditors (function(editor) {

      const repoPath = atom.project.getPaths()[0];
      if (!repoPath) { return; }
      const repoName = repoPath.split('/').pop();
      // TODO: Show some alert to user
      // If config.yml does not exists, return
      const configExists = fs.existsSync(CONFIG_PATH);
      if (!configExists) { return; }
      // Return if user hasn't synced the repo
      try {
        const config = yaml.load(fs.readFileSync(CONFIG_PATH, "utf8"));
        if (!(repoName in config['repos']) || config['repos'][repoName].path !== repoPath) {
          console.log("Skipping non-synced repo")
          return;
        }
      } catch (e) {
        return;
      }

      console.log(`repo path: ${repoPath}`);
      editor.onDidStopChanging(function(event) {
        handleChanges(editor, repoName, repoPath);
      })
    })
  },


  deactivate() {
    this.subscriptions.dispose();
  }


};
