'use babel';

import fs from 'fs';
import ignore from 'ignore';
import { isRepoActive, readYML } from '../utils/common';
import {
    GIT_REPO,
    CONFIG_PATH
} from "../constants";


function isGitFile(path) {
    return path.startsWith(GIT_REPO);
}

export function repoIsNotSynced(repoPath) {
    // If config.yml does not exists, return
    const configExists = fs.existsSync(CONFIG_PATH);
    if (!configExists) {
        return true;
    }
    // Return if user hasn't synced the repo
    try {
        const config = readYML(CONFIG_PATH);
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
