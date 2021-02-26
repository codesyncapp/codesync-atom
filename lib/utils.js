'use babel';

import fs from 'fs';
import yaml from 'js-yaml';
import dateFormat from "dateformat";
import getBranchName from "current-git-branch";
import {diff_match_patch} from "diff-match-patch";
import ignore from 'ignore';

import {
    SHADOW_REPO,
    ORIGINALS_REPO,
    DIFFS_REPO,
    DIFF_SOURCE,
    DATETIME_FORMAT,
    DEFAULT_BRANCH,
    GIT_REPO,
    CONFIG_PATH,
    DELETED_REPO
} from "./constants";

function shouldSkipEvent(repoName, repoPath) {
    // If config.yml does not exists, return
    const configExists = fs.existsSync(CONFIG_PATH);
    if (!configExists) {
        return true;
    }
    // Return if user hasn't synced the repo
    try {
        const config = yaml.load(fs.readFileSync(CONFIG_PATH, "utf8"));
        return !(repoName in config['repos']) || config['repos'][repoName].path !== repoPath;
    } catch (e) {
        return true;
    }
}

export function isGitFile(path) {
    return path.startsWith(GIT_REPO);
}

function shouldIgnoreFile(repoPath, relPath) {
    // Always ignore .git/
    if (isGitFile(relPath)) {
        return true;
    }
    const syncIgnorePath = `${repoPath}/.syncignore`;
    // TODO: See what to do if syncignore is not there
    if (!fs.existsSync(syncIgnorePath)) {
        return true;
    }
    const syncignorePaths = fs.readFileSync(syncIgnorePath, "utf8");
    const splitLines = syncignorePaths.split("\n");
    const ig = ignore().add(splitLines);
    const shouldIgnore = ig.ignores(relPath);
    if (shouldIgnore) {
        console.log(`Skipping syncignored file: ${relPath}`);
    }
    return shouldIgnore;
}

export function handleFileCreated(event) {
    const filePath = event.path;
    if (fs.lstatSync(filePath).isDirectory()) { return; }
    const repoPath = atom.project.getPaths()[0];
    const relPath = filePath.split(`${repoPath}/`)[1];
    const repoName = repoPath.split('/').pop();
    if (!repoPath || shouldSkipEvent(repoName, repoPath) || shouldIgnoreFile(repoPath, relPath)) {
        return;
    }
    console.log(`FileCreated: ${filePath}`);
    const branch = getBranchName({altPath: repoPath});
    const destOriginals = `${ORIGINALS_REPO}/${repoName}/${branch}/${relPath}`;
    const destOriginalsPathSplit = destOriginals.split("/");
    const destOriginalsBasePath = destOriginalsPathSplit.slice(0, destOriginalsPathSplit.length - 1).join("/");
    const destShadow = `${SHADOW_REPO}/${repoName}/${branch}/${relPath}`;
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

export function handleFileDeleted(event) {
    const filePath = event.path;
    const repoPath = atom.project.getPaths()[0];
    const repoName = repoPath.split('/').pop();
    const relPath = filePath.split(`${repoPath}/`)[1];
    if (!repoPath || shouldSkipEvent(repoName, repoPath) || shouldIgnoreFile(repoPath, relPath)) {
        return;
    }
    console.log(`FileDeleted: ${filePath}`);
    const branch = getBranchName({altPath: repoPath});
    // Cache path
    const destDeleted = `${DELETED_REPO}/${repoName}/${branch}/${relPath}`;
    const destDeletedPathSplit = destDeleted.split("/");
    const destDeletedBasePath = destDeletedPathSplit.slice(0, destDeletedPathSplit.length-1).join("/");
    // Shadow path
    const shadowPath = `${SHADOW_REPO}/${repoName}/${branch}/${relPath}`;
    if (fs.existsSync(destDeletedBasePath)) { return; }
    // Add file in originals repo
    fs.mkdirSync(destDeletedBasePath, { recursive: true });
    // File destination will be created or overwritten by default.
    fs.copyFileSync(shadowPath, destDeleted);

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

export function handleFileRenamed(event) {
    const repoPath = atom.project.getPaths()[0];
    if (!repoPath) { return; }
    const repoName = repoPath.split('/').pop();
    const oldAbsPath = event.oldPath;
    const newAbsPath = event.path;
    const newRelPath = newAbsPath.split(`${repoPath}/`)[1];
    if (shouldSkipEvent(repoName, repoPath) || shouldIgnoreFile(repoPath, newRelPath)) {
        return;
    }
    const branch = getBranchName({altPath: repoPath});
    handleRename(repoName, repoPath, branch, oldAbsPath, newAbsPath, fs.lstatSync(newAbsPath).isFile());
}

export function handleChanges(editor) {
    const filePath = editor.getPath();
    const repoPath = atom.project.getPaths()[0];
    const repoName = repoPath.split('/').pop();
    const relPath = filePath.split(`${repoPath}/`)[1];
    if (!repoPath || shouldSkipEvent(repoName, repoPath) || shouldIgnoreFile(repoPath, relPath)) {
        return;
    }
    const text = editor.getText();
    const branch = getBranchName({altPath: repoPath});
    const shadowPath = `${SHADOW_REPO}/${repoName}/${branch}/${relPath}`;
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
    console.log(`Syncing: ${repoName}/${relPath}`);
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

function handleRename(repoName, repoPath, branch, oldAbsPath, newAbsPath, isFile) {
    const oldRelPath = oldAbsPath.split(`${repoPath}/`)[1];
    const newRelPath = newAbsPath.split(`${repoPath}/`)[1];
    const oldShadowPath = `${SHADOW_REPO}/${repoName}/${branch}/${oldRelPath}`;
    const newShadowPath = `${SHADOW_REPO}/${repoName}/${branch}/${newRelPath}`;
    fs.renameSync(oldShadowPath, newShadowPath);

    if (!isFile) {
        console.log(`DirectoryRenamed: ${oldAbsPath} -> ${newAbsPath}`);
        // Add new diff in the buffer
        const newDiff = {};
        newDiff.repo = repoName;
        newDiff.branch = branch;
        newDiff.file_relative_path = '';
        newDiff.is_dir_rename = true;
        newDiff.source = DIFF_SOURCE;
        newDiff.created_at = dateFormat(new Date(), DATETIME_FORMAT);
        newDiff.diff = JSON.stringify({ old_path: oldAbsPath, new_path: newAbsPath });
        // Append new diff in the buffer
        fs.writeFileSync(`${DIFFS_REPO}/${new Date().getTime()}.yml`, yaml.safeDump(newDiff));
        return;
    }

    console.log(`FileRenamed: ${oldAbsPath} -> ${newAbsPath}`);
    // Add new diff in the buffer
    const newDiff = {};
    newDiff.repo = repoName;
    newDiff.branch = branch;
    newDiff.file_relative_path = newRelPath;
    newDiff.is_rename = true;
    newDiff.source = DIFF_SOURCE;
    newDiff.created_at = dateFormat(new Date(), DATETIME_FORMAT);
    newDiff.diff = JSON.stringify({
        old_abs_path: oldAbsPath, new_abs_path: newAbsPath,
        old_rel_path: oldRelPath, new_rel_path: newRelPath
    });
    // Append new diff in the buffer
    fs.writeFileSync(`${DIFFS_REPO}/${new Date().getTime()}.yml`, yaml.safeDump(newDiff));
}
