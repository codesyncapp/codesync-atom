'use babel';

import fs from 'fs';
import path from "path";
import ignore from 'ignore';
import { isRepoActive, readYML } from '../utils/common';
import { GIT_REPO } from "../constants";
import { generateSettings } from "../settings";
import { handleDirectoryRenameDiffs, manageDiff } from "./diff_utils";
import { pathUtils } from "../utils/path_utils";


export function isGitFile(path) {
    return path.startsWith(GIT_REPO);
}

export function shouldIgnoreFile(repoPath, relPath) {
    // Always ignore .git/
    if (isGitFile(relPath)) {
        return true;
    }
    const syncIgnorePath = path.join(repoPath, ".syncignore");
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

export function handleRename(repoPath, branch, oldAbsPath, newAbsPath, isFile) {
    const oldRelPath = oldAbsPath.split(path.join(repoPath, path.sep))[1];
    const newRelPath = newAbsPath.split(path.join(repoPath, path.sep))[1];

    const pathUtilsObj = new pathUtils(repoPath, branch);
    const shadowRepoBranchPath = pathUtilsObj.getShadowRepoBranchPath();
    const oldShadowPath = path.join(shadowRepoBranchPath, oldRelPath);
    const newShadowPath = path.join(shadowRepoBranchPath, newRelPath);
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

export const handleNewFile = (repoPath, branch, filePath) => {
    // Do not continue if file does not exist
    if (!fs.existsSync(filePath)) { return; }
    // Skip for directory
    const lstat = fs.lstatSync(filePath);
    if (lstat.isDirectory()) { return; }
    const relPath = filePath.split(path.join(repoPath, path.sep))[1];
    // Skip .git and syncignore files
    if (shouldIgnoreFile(repoPath, relPath)) { return; }

    const pathUtilsObj = new pathUtils(repoPath, branch);
    const shadowRepoBranchPath = pathUtilsObj.getShadowRepoBranchPath();
    const originalsRepoBranchPath = pathUtilsObj.getOriginalsRepoBranchPath();

    const shadowPath = path.join(shadowRepoBranchPath, relPath);
    const destShadowBasePath = path.dirname(shadowPath);
    const originalsPath = path.join(originalsRepoBranchPath, relPath);
    const destOriginalsBasePath = path.dirname(originalsPath);

    if (fs.existsSync(shadowPath) || fs.existsSync(originalsPath)) { return; }
    console.log(`FileCreated: ${filePath}`);
    // Add file in shadow repo
    fs.mkdirSync(destShadowBasePath, { recursive: true });
    // File destination will be created or overwritten by default.
    fs.copyFileSync(filePath, shadowPath);
    // Add file in originals repo
    fs.mkdirSync(destOriginalsBasePath, { recursive: true });
    // File destination will be created or overwritten by default.
    fs.copyFileSync(filePath, originalsPath);
    // Add new diff in the buffer
    manageDiff(repoPath, branch, relPath, "", true);
};

