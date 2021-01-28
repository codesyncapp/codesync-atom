'use babel';

import fs from 'fs';
import yaml from 'js-yaml';
import dateFormat from "dateformat";
import getBranchName from "current-git-branch";
import {diff_match_patch} from "diff-match-patch";

import { CODESYNC_ROOT, ORIGINALS_REPO, DIFFS_REPO, DIFF_SOURCE, DATETIME_FORMAT, DEFAULT_BRANCH } from "./constants";

export function handleFileCreated(event, repoPath, repoName, branch) {
  const filePath = event.path;
  console.log(`FileCreated: ${filePath}`);
  const relPath = filePath.split(`${repoPath}/`)[1];
  const destOriginals = `${ORIGINALS_REPO}/${repoName}/${branch}/${relPath}`;
  const destOriginalsPathSplit = destOriginals.split("/");
  const destOriginalsBasePath = destOriginalsPathSplit.slice(0, destOriginalsPathSplit.length-1).join("/");
  const destShadow = `${CODESYNC_ROOT}/${repoName}/${branch}/${relPath}`;
  const destShadowPathSplit = destShadow.split("/");
  const destShadowBasePath = destShadowPathSplit.slice(0, destShadowPathSplit.length-1).join("/");

  // Add file in originals repo
  fs.mkdirSync(destOriginalsBasePath, { recursive: true });
  // File destination will be created or overwritten by default.
  fs.copyFileSync(filePath, destOriginals);
  // Add file in shadow repo
  fs.mkdirSync(destShadowBasePath, { recursive: true });
  // File destination will be created or overwritten by default.
  fs.copyFileSync(filePath, destShadow);
  // Add new diff in the buffer
  const newDiff = {};
  newDiff.repo = repoName;
  newDiff.branch = branch || DEFAULT_BRANCH;
  newDiff.file_relative_path = relPath;
  newDiff.is_new_file = true;
  newDiff.source = DIFF_SOURCE;
  newDiff.created_at = dateFormat(new Date(), DATETIME_FORMAT);
  // Append new diff in the buffer
  fs.writeFileSync(`${DIFFS_REPO}/${new Date().getTime()}.yml`, yaml.safeDump(newDiff));
}

export function handleFileDeleted(event, repoPath, repoName, branch) {
  const filePath = event.path;
  console.log(`FileDeleted: ${filePath}`);
  const relPath = filePath.split(`${repoPath}/`)[1];
  const shadowPath = `${CODESYNC_ROOT}/${repoName}/${branch}/${relPath}`;
  const shadowExists = fs.existsSync(shadowPath);
  if (!shadowExists) {
    console.log(`Skipping: Shadow does not exist`);
    return;
  }
  // Add new diff in the buffer
  const newDiff = {};
  newDiff.repo = repoName;
  newDiff.branch = branch || DEFAULT_BRANCH;
  newDiff.file_relative_path = relPath;
  newDiff.is_deleted = true;
  newDiff.source = DIFF_SOURCE;
  newDiff.created_at = dateFormat(new Date(), DATETIME_FORMAT);
  // Append new diff in the buffer
  fs.writeFileSync(`${DIFFS_REPO}/${new Date().getTime()}.yml`, yaml.safeDump(newDiff));
}

export function handleChanges(editor, repoName, repoPath) {
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
  newDiff.branch = branch || DEFAULT_BRANCH;
  newDiff.file_relative_path = relPath;
  newDiff.diff = diffs;
  newDiff.source = DIFF_SOURCE;
  newDiff.created_at = dateFormat(new Date(), 'UTC:yyyy-mm-dd HH:MM:ss.l');
  // Append new diff in the buffer
  fs.writeFileSync(`${DIFFS_REPO}/${new Date().getTime()}.yml`, yaml.safeDump(newDiff));
}