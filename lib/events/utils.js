'use babel';

import fs from 'fs';
import path from "path";
import ignore from 'ignore';
import { generateSettings } from "../settings";
import { isRepoActive, isUserActive, readYML } from '../utils/common';
import { IGNORABLE_DIRECTORIES, SYNCIGNORE } from "../constants";


export function shouldIgnoreFile(repoPath, relPath) {
    // Allow file sync if it is not there is no .syncignore
    const ignorableDirs = ignore().add(IGNORABLE_DIRECTORIES);
    const isIgnorableDir = ignorableDirs.ignores(relPath);
    if (isIgnorableDir) return true;
    const syncIgnorePath = path.join(repoPath, SYNCIGNORE);
    // TODO: See what to do if syncignore is not there
    if (!fs.existsSync(syncIgnorePath)) return false;
    const syncignorePaths = fs.readFileSync(syncIgnorePath, "utf8");
    const splitLines = syncignorePaths.split("\n");
    const ig = ignore().add(splitLines);
    const shouldIgnore = ig.ignores(relPath);
    if (shouldIgnore) {console.log(`Skipping syncignored file: ${relPath}`);}
    return shouldIgnore;
}

export function isRepoSynced(repoPath) {
    if (!repoPath) return false;
    const settings = generateSettings();
    const configPath = settings.CONFIG_PATH;
    // If config.yml does not exist, return
    if (!fs.existsSync(configPath)) return false;
    try {
        const config = readYML(configPath);
        if (!isRepoActive(config, repoPath)) return false;
        return isAccountActive(config.repos[repoPath].email);
    } catch (e) {
        return false;
    }
}

export const isAccountActive = (email) => {
    const settings = generateSettings();
    if (!fs.existsSync(settings.USER_PATH)) return false;
    // Return if user hasn't synced the repo
    const users = readYML(settings.USER_PATH) || {};
    const user = users[email];
    return isUserActive(user);
};
