'use babel';

import fs from 'fs';
import path from "path";
import ignore from 'ignore';
import { isRepoActive, readYML } from '../utils/common';
import { GIT_REPO } from "../constants";
import { generateSettings } from "../settings";
import { handleDirectoryRenameDiffs, manageDiff } from "./diff_utils";


export function isGitFile(path) {
    return path.startsWith(GIT_REPO);
}

export function repoIsNotSynced(repoPath) {
    const settings = generateSettings();
    // If config.yml does not exists, return
    const configExists = fs.existsSync(settings.CONFIG_PATH);
    if (!configExists) {
        return true;
    }
    // Return if user hasn't synced the repo
    try {
        const config = readYML(settings.CONFIG_PATH);
        return !isRepoActive(config, repoPath);
    } catch (e) {
        return true;
    }
}

export function shouldIgnoreFile(repoPath, relPath) {
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

export const handleNewFile = (repoPath, branch, filePath) => {
    // Do not continue if file does not exist
    if (!fs.existsSync(filePath)) { return; }
    // Skip for directory
    const lstat = fs.lstatSync(filePath);
    if (lstat.isDirectory()) { return; }
    const settings = generateSettings();
    const relPath = filePath.split(`${repoPath}/`)[1];
    // Skip .git/ and syncignore files
    if (shouldIgnoreFile(repoPath, relPath)) { return; }
    const destShadow = path.join(settings.SHADOW_REPO, `${repoPath}/${branch}/${relPath}`);
    const destShadowPathSplit = destShadow.split("/");
    const destShadowBasePath = destShadowPathSplit.slice(0, destShadowPathSplit.length-1).join("/");
    const destOriginals = path.join(settings.ORIGINALS_REPO, `${repoPath}/${branch}/${relPath}`);
    const destOriginalsPathSplit = destOriginals.split("/");
    const destOriginalsBasePath = destOriginalsPathSplit.slice(0, destOriginalsPathSplit.length-1).join("/");
    if (fs.existsSync(destShadow) || fs.existsSync(destOriginals)) { return; }
    console.log(`FileCreated: ${filePath}`);
    // Add file in shadow repo
    fs.mkdirSync(destShadowBasePath, { recursive: true });
    // File destination will be created or overwritten by default.
    fs.copyFileSync(filePath, destShadow);
    // Add file in originals repo
    fs.mkdirSync(destOriginalsBasePath, { recursive: true });
    // File destination will be created or overwritten by default.
    fs.copyFileSync(filePath, destOriginals);
    // Add new diff in the buffer
    manageDiff(repoPath, branch, relPath, "", true);
};


export function handleRename(repoPath, branch, oldAbsPath, newAbsPath, isFile) {
    const settings = generateSettings();
    const oldRelPath = oldAbsPath.split(`${repoPath}/`)[1];
    const newRelPath = newAbsPath.split(`${repoPath}/`)[1];
    const oldShadowPath = path.join(settings.SHADOW_REPO, `${repoPath}/${branch}/${oldRelPath}`);
    const newShadowPath = path.join(settings.SHADOW_REPO, `${repoPath}/${branch}/${newRelPath}`);
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
