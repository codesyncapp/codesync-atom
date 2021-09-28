'use babel';

import fs from 'fs';
import path from 'path';
import getBranchName from "current-git-branch";
import {DEFAULT_BRANCH} from "../constants";
import { pathUtils } from "../utils/path_utils";
import { diff_match_patch } from "diff-match-patch";
import { manageDiff, handleDirectoryDeleteDiffs } from "./diff_utils";
import { handleNewFile, handleRename, repoIsNotSynced, shouldIgnoreFile } from './utils';


export function handleChanges(editor) {
    const filePath = editor.getPath();
    const repoPath = atom.project.getPaths()[0];
    if (!repoPath) return;
    const relPath = filePath.split(path.join(repoPath, path.sep))[1];
    if (repoIsNotSynced(repoPath) || shouldIgnoreFile(repoPath, relPath)) {
        return;
    }
    const text = editor.getText();
    const branch = getBranchName({altPath: repoPath}) || DEFAULT_BRANCH;

    const pathUtilsObj = new pathUtils(repoPath, branch);
    const shadowPath = path.join(pathUtilsObj.getShadowRepoBranchPath(), relPath);

    if (!fs.existsSync(shadowPath)) {
        // Creating shadow file if shadow does not exist somehow
        const destShadowBasePath = path.dirname(shadowPath);
        // Add file in shadow repo
        fs.mkdirSync(destShadowBasePath, {recursive: true});
        // File destination will be created or overwritten by default.
        fs.copyFileSync(filePath, shadowPath);
        return;
    }
    // Read shadow file
    const shadowText = fs.readFileSync(shadowPath, "utf8");
    // If shadow text is same as current content, no need to compute diffs
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
    manageDiff(repoPath, branch, relPath, diffs);
}

export function handleFileCreated(event) {
    const filePath = event.path;
    const repoPath = atom.project.getPaths()[0];
    if (!repoPath) return;
    const branch = getBranchName({ altPath: repoPath }) || DEFAULT_BRANCH;
    handleNewFile(repoPath, branch, filePath);
}

export function handleFileDeleted(event) {
    const itemPath = event.path;
    const repoPath = atom.project.getPaths()[0];
    if (!repoPath) return;
    const relPath = itemPath.split(path.join(repoPath, path.sep))[1];
    if (repoIsNotSynced(repoPath) || shouldIgnoreFile(repoPath, relPath)) return;

    const branch = getBranchName({altPath: repoPath}) || DEFAULT_BRANCH;
    // Shadow path
    const pathUtilsObj = new pathUtils(repoPath, branch);
    const shadowPath = path.join(pathUtilsObj.getShadowRepoBranchPath(), relPath);

    if (!fs.existsSync(shadowPath)) return;

    const lstat = fs.lstatSync(shadowPath);

    if (lstat.isDirectory()) {
        console.log(`DirectoryDeleted: ${itemPath}`);
        handleDirectoryDeleteDiffs(repoPath, branch, relPath);
        return;
    }
    if (!lstat.isFile()) { return; }

    console.log(`FileDeleted: ${itemPath}`);

    // Cache path
    const cacheFilePath = path.join(pathUtilsObj.getDeletedRepoBranchPath(), relPath);
    const cacheDirectories = path.dirname(cacheFilePath);

    if (fs.existsSync(cacheFilePath)) { return; }
    // Add file in .deleted repo
	if (!fs.existsSync(cacheDirectories)) {
        fs.mkdirSync(cacheDirectories, { recursive: true });
    }
    // File destination will be created or overwritten by default.
    fs.copyFileSync(shadowPath, cacheFilePath);
    // write diff
    manageDiff(repoPath, branch, relPath, "", false, false, true);
}

export function handleFileRenamed(event) {
    const repoPath = atom.project.getPaths()[0];
    if (!repoPath) { return; }
    const oldAbsPath = event.oldPath;
    const newAbsPath = event.path;
    const newRelPath = newAbsPath.split(path.join(repoPath, path.sep))[1];

    if (repoIsNotSynced(repoPath) || shouldIgnoreFile(repoPath, newRelPath)) {
        return;
    }
    const branch = getBranchName({altPath: repoPath}) || DEFAULT_BRANCH;
    handleRename(repoPath, branch, oldAbsPath, newAbsPath, fs.lstatSync(newAbsPath).isFile());
}
