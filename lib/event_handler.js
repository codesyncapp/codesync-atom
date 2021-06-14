'use babel';

import fs from 'fs';
import path from 'path';
import getBranchName from "current-git-branch";
import { diff_match_patch } from "diff-match-patch";

import {
    SHADOW_REPO,
    ORIGINALS_REPO,
    DELETED_REPO
} from "./constants";

import { manageDiff, handleDirectoryRenameDiffs, handleDirectoryDeleteDiffs } from "./utils/diff_utils";
import { shouldSkipEvent, shouldIgnoreFile } from './utils/event_utils';


export function handleChanges(editor) {
    const filePath = editor.getPath();
    const repoPath = atom.project.getPaths()[0];
    const relPath = filePath.split(`${repoPath}/`)[1];
    if (!repoPath || shouldSkipEvent(repoPath) || shouldIgnoreFile(repoPath, relPath)) {
        return;
    }
    const text = editor.getText();
    const branch = getBranchName({altPath: repoPath});
    const shadowPath = `${SHADOW_REPO}/${repoPath.slice(1)}/${branch}/${relPath}`;
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
    manageDiff(repoPath, branch, relPath, diffs);
}

export function handleFileCreated(event) {
    const filePath = event.path;
    if (fs.lstatSync(filePath).isDirectory()) { return; }
    const repoPath = atom.project.getPaths()[0];
    const relPath = filePath.split(`${repoPath}/`)[1];
    if (!repoPath || shouldSkipEvent(repoPath) || shouldIgnoreFile(repoPath, relPath)) {
        return;
    }
    console.log(`FileCreated: ${filePath}`);
    const branch = getBranchName({altPath: repoPath});
    const destOriginals = `${ORIGINALS_REPO}/${repoPath.slice(1)}/${branch}/${relPath}`;
    const destOriginalsPathSplit = destOriginals.split("/");
    const destOriginalsBasePath = destOriginalsPathSplit.slice(0, destOriginalsPathSplit.length - 1).join("/");
    const destShadow = `${SHADOW_REPO}/${repoPath.slice(1)}/${branch}/${relPath}`;
    const destShadowPathSplit = destShadow.split("/");
    const destShadowBasePath = destShadowPathSplit.slice(0, destShadowPathSplit.length - 1).join("/");
    // Skip if file is already in .originals
    if (fs.existsSync(destOriginals)) {
        return;
    }
    // Add file in originals repo
    fs.mkdirSync(destOriginalsBasePath, {recursive: true});
    // File destination will be created or overwritten by default.
    fs.copyFileSync(filePath, destOriginals);
    // Add file in shadow repo
    fs.mkdirSync(destShadowBasePath, {recursive: true});
    // File destination will be created or overwritten by default.
    fs.copyFileSync(filePath, destShadow);

    manageDiff(repoPath, branch, relPath, "", true);
}

export function handleFileDeleted(event) {
    const itemPath = event.path;
    const repoPath = atom.project.getPaths()[0];
    const relPath = itemPath.split(`${repoPath}/`)[1];
    if (!repoPath || shouldSkipEvent(repoPath) || shouldIgnoreFile(repoPath, relPath)) {
        return;
    }

    const branch = getBranchName({altPath: repoPath});

    // Shadow path
    const shadowPath = `${SHADOW_REPO}/${repoPath.slice(1)}/${branch}/${relPath}`;
    const lstat = fs.lstatSync(shadowPath);		

    if (!fs.existsSync(shadowPath)) { return; }

    if (lstat.isDirectory()) {
        console.log(`DirectoryDeleted: ${itemPath}`);
        handleDirectoryDeleteDiffs(repoPath, branch, relPath);
        return;
    }
    if (!lstat.isFile()) { return; }

    console.log(`FileDeleted: ${itemPath}`);

    // Cache path
    const destDeleted = path.join(DELETED_REPO, `${repoPath}/${branch}/${relPath}`);;
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
    if (shouldSkipEvent(repoPath) || shouldIgnoreFile(repoPath, newRelPath)) {
        return;
    }
    const branch = getBranchName({altPath: repoPath});
    handleRename(repoPath, branch, oldAbsPath, newAbsPath, fs.lstatSync(newAbsPath).isFile());
}

function handleRename(repoPath, branch, oldAbsPath, newAbsPath, isFile) {
    const oldRelPath = oldAbsPath.split(`${repoPath}/`)[1];
    const newRelPath = newAbsPath.split(`${repoPath}/`)[1];
    const oldShadowPath = `${SHADOW_REPO}/${repoPath.slice(1)}/${branch}/${oldRelPath}`;
    const newShadowPath = `${SHADOW_REPO}/${repoPath.slice(1)}/${branch}/${newRelPath}`;
    fs.renameSync(oldShadowPath, newShadowPath);

    if (!isFile) {
        console.log(`DirectoryRenamed: ${oldAbsPath} -> ${newAbsPath}`);
        const diff = JSON.stringify({ old_path: oldAbsPath, new_path: newAbsPath });
		handleDirectoryRenameDiffs(repoPath, branch, diff);
        return;
    }

    console.log(`FileRenamed: ${oldAbsPath} -> ${newAbsPath}`);
    const diff = JSON.stringify({
        old_abs_path: oldAbsPath, 
        new_abs_path: newAbsPath,
        old_rel_path: oldRelPath, 
        new_rel_path: newRelPath
    });
    // Add new diff in the buffer
    manageDiff(repoPath, branch, newRelPath, diff, false, true);
}
