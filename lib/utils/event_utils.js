'use babel';

import fs from 'fs';
import yaml from 'js-yaml';
import ignore from 'ignore';
import {
    GIT_REPO,
    CONFIG_PATH
} from "../constants";


function isGitFile(path) {
    return path.startsWith(GIT_REPO);
}

export function shouldSkipEvent(repoPath) {
    // If config.yml does not exists, return
    const configExists = fs.existsSync(CONFIG_PATH);
    if (!configExists) {
        return true;
    }
    // Return if user hasn't synced the repo
    try {
        const config = yaml.load(fs.readFileSync(CONFIG_PATH, "utf8"));
        return !(repoPath in config['repos']);
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
