'use babel';

import fs from 'fs';
import path from 'path';
import getBranchName from "current-git-branch";
import {DEFAULT_BRANCH} from "../constants";
import { diff_match_patch } from "diff-match-patch";
import { manageDiff, handleDirectoryDeleteDiffs } from "./diff_utils";
import { handleNewFile, handleRename, repoIsNotSynced, shouldIgnoreFile } from './utils';
import { generateSettings } from "../settings";


export function handleChanges(editor) {
    const filePath = editor.getPath();
    const repoPath = atom.project.getPaths()[0];
    const relPath = filePath.split(`${repoPath}/`)[1];
    if (!repoPath || repoIsNotSynced(repoPath) || shouldIgnoreFile(repoPath, relPath)) {
        return;
    }
    const settings = generateSettings();
    const text = editor.getText();
    const branch = getBranchName({altPath: repoPath});
    const shadowPath = `${settings.SHADOW_REPO}/${repoPath.slice(1)}/${branch}/${relPath}`;
    const shadowExists = fs.existsSync(shadowPath);

    if (!shadowExists) {
        // Creating shadow file if shadow does not exist somehow
        const destShadow = `${settings.SHADOW_REPO}/${repoPath.slice(1)}/${branch}/${relPath}`;
        const destShadowPathSplit = destShadow.split("/");
        const destShadowBasePath = destShadowPathSplit.slice(0, destShadowPathSplit.length - 1).join("/");
        // Add file in shadow repo
        fs.mkdirSync(destShadowBasePath, {recursive: true});
        // File destination will be created or overwritten by default.
        fs.copyFileSync(filePath, destShadow);
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
    const relPath = filePath.split(`${repoPath}/`)[1];
    if (!repoPath || repoIsNotSynced(repoPath) || shouldIgnoreFile(repoPath, relPath)) {
        return;
    }
    const branch = getBranchName({ altPath: repoPath }) || DEFAULT_BRANCH;
    handleNewFile(repoPath, branch, filePath);
}

export function handleFileDeleted(event) {
    const itemPath = event.path;
    const repoPath = atom.project.getPaths()[0];
    const relPath = itemPath.split(`${repoPath}/`)[1];
    if (!repoPath || repoIsNotSynced(repoPath) || shouldIgnoreFile(repoPath, relPath)) {
        return;
    }

    const branch = getBranchName({altPath: repoPath});
    const settings = generateSettings();

    // Shadow path
    const shadowPath = `${settings.SHADOW_REPO}/${repoPath.slice(1)}/${branch}/${relPath}`;

    if (!fs.existsSync(shadowPath)) { return; }

    const lstat = fs.lstatSync(shadowPath);

    if (lstat.isDirectory()) {
        console.log(`DirectoryDeleted: ${itemPath}`);
        handleDirectoryDeleteDiffs(repoPath, branch, relPath);
        return;
    }
    if (!lstat.isFile()) { return; }

    console.log(`FileDeleted: ${itemPath}`);

    // Cache path
    const destDeleted = path.join(settings.DELETED_REPO, `${repoPath}/${branch}/${relPath}`);
    const destDeletedPathSplit = destDeleted.split("/");
    const destDeletedBasePath = destDeletedPathSplit.slice(0, destDeletedPathSplit.length-1).join("/");

    if (fs.existsSync(destDeleted)) { return; }
    // Add file in .deleted repo
	if (!fs.existsSync(destDeletedBasePath)) {
        fs.mkdirSync(destDeletedBasePath, { recursive: true });
    }
    // File destination will be created or overwritten by default.
    fs.copyFileSync(shadowPath, destDeleted);
    // write diff
    manageDiff(repoPath, branch, relPath, "", false, false, true);
}

export function handleFileRenamed(event) {
    const repoPath = atom.project.getPaths()[0];
    if (!repoPath) { return; }
    const oldAbsPath = event.oldPath;
    const newAbsPath = event.path;
    const newRelPath = newAbsPath.split(`${repoPath}/`)[1];
    if (repoIsNotSynced(repoPath) || shouldIgnoreFile(repoPath, newRelPath)) {
        return;
    }
    const branch = getBranchName({altPath: repoPath});
    handleRename(repoPath, branch, oldAbsPath, newAbsPath, fs.lstatSync(newAbsPath).isFile());
}
