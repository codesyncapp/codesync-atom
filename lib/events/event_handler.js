'use babel';

import fs from 'fs';
import path from 'path';

import { getBranch } from "../utils/common";
import { pathUtils } from "../utils/path_utils";
import { diff_match_patch } from "diff-match-patch";
import { isRepoSynced, shouldIgnoreFile } from './utils';
import {
    manageDiff,
    handleDirectoryDeleteDiffs,
    handleDirectoryRenameDiffs
} from "./diff_utils";


export class eventHandler {

    constructor() {
        this.repoPath = atom.project.getPaths()[0] || "";
        this.branch = getBranch(this.repoPath);
        this.repoIsNotSynced = !isRepoSynced(this.repoPath);
        this.pathUtils = new pathUtils(this.repoPath, this.branch);
        this.shadowRepoBranchPath = this.pathUtils.getShadowRepoBranchPath();
        this.deletedRepoBranchPath = this.pathUtils.getDeletedRepoBranchPath();
        this.originalsRepoBranchPath = this.pathUtils.getOriginalsRepoBranchPath();
    }

    handleChangeEvent = (editor) => {
        if (this.repoIsNotSynced) return;
        const filePath = editor.getPath();
        const relPath = filePath.split(path.join(this.repoPath, path.sep))[1];
        if (shouldIgnoreFile(this.repoPath, relPath)) return;
        const text = editor.getText();

        const shadowPath = path.join(this.shadowRepoBranchPath, relPath);

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
        fs.writeFileSync(shadowPath, text);
        // Compute diffs
        const dmp = new diff_match_patch();
        const patches = dmp.patch_make(shadowText, text);
        //  Create text representation of patches objects
        const diffs = dmp.patch_toText(patches);
        manageDiff(this.repoPath, this.branch, relPath, diffs);
    }

    handleNewFile = (filePath) => {
        if (this.repoIsNotSynced) return;
        // Do not continue if file does not exist
        if (!fs.existsSync(filePath)) { return; }
        // Skip for directory
        const lstat = fs.lstatSync(filePath);
        if (lstat.isDirectory()) { return; }
        const relPath = filePath.split(path.join(this.repoPath, path.sep))[1];
        // Skip .git and syncignore files
        if (shouldIgnoreFile(this.repoPath, relPath)) { return; }

        const shadowPath = path.join(this.shadowRepoBranchPath, relPath);
        const originalsPath = path.join(this.originalsRepoBranchPath, relPath);

        if (fs.existsSync(shadowPath) || fs.existsSync(originalsPath)) { return; }
        console.log(`FileCreated: ${filePath}`);

        const destShadowBasePath = path.dirname(shadowPath);
        const destOriginalsBasePath = path.dirname(originalsPath);
        // Add file in shadow repo
        fs.mkdirSync(destShadowBasePath, { recursive: true });
        // File destination will be created or overwritten by default.
        fs.copyFileSync(filePath, shadowPath);
        // Add file in originals repo
        fs.mkdirSync(destOriginalsBasePath, { recursive: true });
        // File destination will be created or overwritten by default.
        fs.copyFileSync(filePath, originalsPath);
        // Add new diff in the buffer
        manageDiff(this.repoPath, this.branch, relPath, "", true);
    };

    handleFileDeleted = (itemPath) => {
        if (this.repoIsNotSynced) return;

        const relPath = itemPath.split(path.join(this.repoPath, path.sep))[1];
        if (shouldIgnoreFile(this.repoPath, relPath)) return;

        // Shadow path
        const shadowPath = path.join(this.shadowRepoBranchPath, relPath);
        if (!fs.existsSync(shadowPath)) return;

        const lstat = fs.lstatSync(shadowPath);

        if (lstat.isDirectory()) {
            console.log(`DirectoryDeleted: ${itemPath}`);
            handleDirectoryDeleteDiffs(this.repoPath, this.branch, relPath);
            return;
        }
        if (!lstat.isFile()) { return; }

        console.log(`FileDeleted: ${itemPath}`);
        // Cache path
        const cacheFilePath = path.join(this.deletedRepoBranchPath, relPath);
        const cacheDirectories = path.dirname(cacheFilePath);

        if (fs.existsSync(cacheFilePath)) { return; }
        // Add file in .deleted repo
        if (!fs.existsSync(cacheDirectories)) {
            fs.mkdirSync(cacheDirectories, { recursive: true });
        }
        // File destination will be created or overwritten by default.
        fs.copyFileSync(shadowPath, cacheFilePath);
        // write diff
        manageDiff(this.repoPath, this.branch, relPath, "", false, false, true);
    }

    handleRenameEvent = (oldAbsPath, newAbsPath) => {
        if (this.repoIsNotSynced) return;
        const oldRelPath = oldAbsPath.split(path.join(this.repoPath, path.sep))[1];
        const newRelPath = newAbsPath.split(path.join(this.repoPath, path.sep))[1];

        if (shouldIgnoreFile(this.repoPath, newRelPath)) return;
        const isDirectory = fs.lstatSync(newAbsPath).isDirectory();

        const oldShadowPath = path.join(this.shadowRepoBranchPath, oldRelPath);
        const newShadowPath = path.join(this.shadowRepoBranchPath, newRelPath);
        fs.renameSync(oldShadowPath, newShadowPath);

        if (isDirectory) {
            console.log(`DirectoryRenamed: ${oldAbsPath} -> ${newAbsPath}`);
            const diff = JSON.stringify({ old_path: oldAbsPath, new_path: newAbsPath });
            handleDirectoryRenameDiffs(this.repoPath, this.branch, diff);
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
        manageDiff(this.repoPath, this.branch, newRelPath, diff, false, true);
    }
}

