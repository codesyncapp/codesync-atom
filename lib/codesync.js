'use babel';

import { CompositeDisposable } from 'atom';
import fs from 'fs';
import yaml from 'js-yaml';

import { diff_match_patch } from 'diff-match-patch';
import getBranchName from 'current-git-branch';
import dateFormat from "dateformat";

// TODO: Move to separate file
const CODESYNC_ROOT = '/usr/local/bin/.codesync';
const DIFFS_REPO = `${CODESYNC_ROOT}/.diffs`;
const CONFIG_PATH = `${CODESYNC_ROOT}/config.yml`;

export default {

  subscriptions: null,

  activate(state) {
    atom.workspace.observeTextEditors (function(editor) {

      const repoPath = atom.project.getPaths()[0];
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
        const filePath = editor.getPath();
        const text = editor.getText();
        const branch = getBranchName({ altPath: repoPath });
        const relPath = filePath.split(`${repoPath}/`)[1];
        const shadowPath = `${CODESYNC_ROOT}/${repoName}/${branch}/${relPath}`;
        const shadowExists = fs.existsSync(shadowPath);

        if (!shadowExists) {
    			// TODO: Create shadow file?
          console.log('Skipping: Shadow does not exist');
    			return;
    		}
    		// Read shadow file
    		const shadowText = fs.readFileSync(shadowPath, "utf8");
        if (!shadowText) {
          console.log('Skipping: Empty Shadow');
        }
        // If shadow text is same as current content, no need to compute diffs
        // console.log('MathcingText: ', shadowText, shadowText === text)
        if (shadowText === text) {
          console.log('Skipping: Shadow is identical to content');
          return;
        }
    		// Update shadow file
    		fs.writeFile(shadowPath, text, function (err) {
    			if (err) throw err;
    		});
        // Compute diffs
        const dmp = new diff_match_patch();
        const patches = dmp.patch_make(shadowText, text);
        //  Create text representation of patches objects
        const diffs = dmp.patch_toText(patches);
        // Skip empty diffs
        if (!diffs) {
          console.log('Skipping: Diff is empty');
          return;
        }
        // Add new diff in the buffer
        const newDiff = {};
        newDiff.repo = repoName;
        newDiff.branch = branch || 'default';
        newDiff.file = relPath;
        newDiff.diff = diffs;
        newDiff.created_at = dateFormat(new Date(), 'UTC:yyyy-mm-dd HH:MM:ss.l');
        // Append new diff in the buffer
        fs.writeFileSync(`${DIFFS_REPO}/${new Date().getTime()}.yml`, yaml.safeDump(newDiff));
      })
    })
  },


  deactivate() {
    this.subscriptions.dispose();
  }


};
