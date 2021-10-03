'use babel';

import fs from 'fs';
import path from "path";
import ignore from 'ignore';
import { generateSettings } from "../settings";
import { pathUtils } from "../utils/path_utils";
import { isRepoActive, readYML } from '../utils/common';
import { IGNORABLE_DIRECTORIES } from "../constants";
import { handleDirectoryRenameDiffs, manageDiff } from "./diff_utils";


export function shouldIgnoreFile(repoPath, relPath) {
    // Allow file sync if it is not there is no .syncignore
    const ignorableDirs = ignore().add(IGNORABLE_DIRECTORIES);
    const isIgnorableDir = ignorableDirs.ignores(relPath);
    if (isIgnorableDir) return true;
    const syncIgnorePath = path.join(repoPath, ".syncignore");
    // TODO: See what to do if syncignore is not there
    if (!fs.existsSync(syncIgnorePath)) return false;
    const syncignorePaths = fs.readFileSync(syncIgnorePath, "utf8");
    const splitLines = syncignorePaths.split("\n");
    const ig = ignore().add(splitLines);
    const shouldIgnore = ig.ignores(relPath);
    if (shouldIgnore) {
        console.log(`Skipping syncignored file: ${relPath}`);
    }
    return shouldIgnore;
}

export function isRepoSynced(repoPath) {
    if (!repoPath) return false;
    const settings = generateSettings();
    // If config.yml does not exists, return
    const configExists = fs.existsSync(settings.CONFIG_PATH);
    if (!configExists) return false;
    // Return if user hasn't synced the repo
    try {
        const config = readYML(settings.CONFIG_PATH);
        return isRepoActive(config, repoPath);
    } catch (e) {
        return false;
    }
}
