'use babel';

import fs from 'fs';
import path from 'path';
import walk from "walk";
import yaml from 'js-yaml';
import dateFormat from "dateformat";

import { initUtils } from "../init/utils";
import { getBranch, readYML } from "../utils/common";
import { pathUtils } from "../utils/path_utils";
import { diff_match_patch } from "diff-match-patch";
import { isRepoSynced, shouldIgnoreFile } from './utils';
import { generateSettings } from "../settings";
import { DATETIME_FORMAT, DIFF_SOURCE } from "../constants";


export class eventHandler {
    // Diff props
    isNewFile = false;
    isRename = false;
    isDelete = false;
    createdAt = '';
    settings = generateSettings();

    constructor(repoPath="", createdAt="", viaDaemon=false) {
        this.repoPath = repoPath || atom.project.getPaths()[0] || "";
        this.createdAt = createdAt;
        this.viaDaemon = viaDaemon;
        this.branch = getBranch(this.repoPath);
        this.repoIsNotSynced = !isRepoSynced(this.repoPath);
        this.pathUtils = new pathUtils(this.repoPath, this.branch);
        this.shadowRepoBranchPath = this.pathUtils.getShadowRepoBranchPath();
        this.deletedRepoBranchPath = this.pathUtils.getDeletedRepoBranchPath();
        this.originalsRepoBranchPath = this.pathUtils.getOriginalsRepoBranchPath();
    }

    addDiff = (relPath, diffs) => {
        // Skip empty diffs
        if (!diffs && !this.isNewFile && !this.isDelete) {
            console.log(`addDiff: Skipping empty diffs`);
            return;
        }
        if (!this.createdAt) {
            this.createdAt = dateFormat(new Date(), DATETIME_FORMAT);
        }
        // Add new diff in the buffer
        const newDiff = {};
        newDiff.source = DIFF_SOURCE;
        newDiff.repo_path = this.repoPath;
        newDiff.branch = this.branch;
        newDiff.file_relative_path = relPath;
        newDiff.diff = diffs;
        newDiff.is_new_file = this.isNewFile;
        newDiff.is_rename = this.isRename;
        newDiff.is_deleted = this.isDelete;
        newDiff.created_at = this.createdAt;
        // Append new diff in the buffer
        const diffFileName = `${new Date().getTime()}.yml`;
        const diffFilePath = path.join(this.settings.DIFFS_REPO, diffFileName);
        fs.writeFileSync(diffFilePath, yaml.safeDump(newDiff));
    };

    addPathToConfig = (relPath, oldRelPath = "") => {
        const configJSON = readYML(this.settings.CONFIG_PATH);
        const configFiles = configJSON.repos[this.repoPath].branches[this.branch];
        if (this.isNewFile) {
            configFiles[relPath] = null;
        }
        if (this.isRename) {
            // Use old file ID for the renamed file
            configFiles[relPath] = configFiles[oldRelPath];
            delete configFiles[oldRelPath];
        }
        // write file id to config.yml
        fs.writeFileSync(this.settings.CONFIG_PATH, yaml.safeDump(configJSON));
    }

    handleChangeEvent = (editor) => {
        if (this.repoIsNotSynced) return;
        const filePath = editor.getPath();
        const relPath = filePath.split(path.join(this.repoPath, path.sep))[1];
        if (shouldIgnoreFile(this.repoPath, relPath)) return;
        const text = editor.getText();
        this.handleChanges(filePath, text);
    }

    handleChanges = (filePath, currentText) => {
        const relPath = filePath.split(path.join(this.repoPath, path.sep))[1];
        // Skip .git and .syncignore files
        if (shouldIgnoreFile(this.repoPath, relPath)) return;
        let shadowText = "";
        const shadowPath = path.join(this.shadowRepoBranchPath, relPath);
        if (!fs.existsSync(shadowPath)) {
            const initUtilsObj = new initUtils(this.repoPath);
            initUtilsObj.copyFilesTo([filePath], this.shadowRepoBranchPath);
        } else {
            // Read shadow file
            shadowText = fs.readFileSync(shadowPath, "utf8");
        }
        // If shadow text is same as current content, no need to compute diffs
        if (shadowText === currentText) {
            if (!this.viaDaemon) {
                console.log(`Skipping handleChanges: Shadow is same as text`);
            }
            return;
        }
        // Update shadow file
        fs.writeFileSync(shadowPath, currentText);
        // Compute diffs
        const dmp = new diff_match_patch();
        const patches = dmp.patch_make(shadowText, currentText);
        //  Create text representation of patches objects
        const diffs = dmp.patch_toText(patches);
        // Add new diff in the buffer
        this.addDiff(relPath, diffs);
    };

    handleCreate = (filePath) => {
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
        const initUtilsObj = new initUtils(this.repoPath);
        initUtilsObj.copyFilesTo([filePath], this.shadowRepoBranchPath);
        initUtilsObj.copyFilesTo([filePath], this.originalsRepoBranchPath);
        // Add new diff in the buffer
        this.isNewFile = true;
        // Add null fileId in config
        this.addPathToConfig(relPath);
        this.addDiff(relPath, "");
    };

    handleDelete = (itemPath) => {
        if (this.repoIsNotSynced) return;

        const relPath = itemPath.split(path.join(this.repoPath, path.sep))[1];
        if (shouldIgnoreFile(this.repoPath, relPath)) return;

        // Shadow path
        const shadowPath = path.join(this.shadowRepoBranchPath, relPath);
        if (!fs.existsSync(shadowPath)) return;

        const lstat = fs.lstatSync(shadowPath);

        if (lstat.isDirectory()) {
            console.log(`DirectoryDeleted: ${itemPath}`);
            this.handleDirectoryDeleteDiffs(relPath);
            return;
        }
        if (!lstat.isFile()) { return; }
        // Cache file path
        const cacheFilePath = path.join(this.deletedRepoBranchPath, relPath);
        if (fs.existsSync(cacheFilePath)) { return; }

        console.log(`FileDeleted: ${itemPath}`);
        const initUtilsObj = new initUtils(this.repoPath);
        initUtilsObj.copyFilesTo([shadowPath], this.pathUtils.getDeletedRepoPath(), true);
        // Add new diff in the buffer
        this.isDelete = true;
        this.addDiff(relPath, "");
    }

    handleDirectoryDeleteDiffs = (dirRelPath) => {
        const shadowDirPath = path.join(this.shadowRepoBranchPath, dirRelPath);
        const pathUtilsObj = this.pathUtils;
        const repoPath = this.repoPath;
        const branch = this.branch;
        this.isDelete = true;
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const that = this;
        // No need to skip repos here as it is for specific repo
        const walker = walk.walk(shadowDirPath);
        walker.on("file", function (root, fileStats, next) {
            const filePath = path.join(root, fileStats.name);
            const relPath = filePath.split(path.join(pathUtilsObj.formattedRepoPath, branch, path.sep))[1];
            const cacheRepoBranchPath = pathUtilsObj.getDeletedRepoBranchPath();
            const cacheFilePath = path.join(cacheRepoBranchPath, relPath);
            if (fs.existsSync(cacheFilePath)) {
                return next();
            }
            // Create directories
            const initUtilsObj = new initUtils(repoPath);
            initUtilsObj.copyFilesTo([filePath], pathUtilsObj.getDeletedRepoPath());
            that.addDiff(relPath, "");
            next();
        });
    };


    handleRename = (oldAbsPath, newAbsPath) => {
        if (this.repoIsNotSynced) return;
        const oldRelPath = oldAbsPath.split(path.join(this.repoPath, path.sep))[1];
        const newRelPath = newAbsPath.split(path.join(this.repoPath, path.sep))[1];

        if (shouldIgnoreFile(this.repoPath, newRelPath)) return;
        const isDirectory = fs.lstatSync(newAbsPath).isDirectory();

        const oldShadowPath = path.join(this.shadowRepoBranchPath, oldRelPath);
        const newShadowPath = path.join(this.shadowRepoBranchPath, newRelPath);
        if (fs.existsSync(oldShadowPath)) {
            fs.renameSync(oldShadowPath, newShadowPath);
        }
        if (isDirectory) {
            console.log(`DirectoryRenamed: ${oldAbsPath} -> ${newAbsPath}`);
            this.handleDirectoryRenameDiffs(oldAbsPath, newAbsPath);
            return;
        }

        console.log(`FileRenamed: ${oldAbsPath} -> ${newAbsPath}`);
        const diff = JSON.stringify({
            old_rel_path: oldRelPath,
            new_rel_path: newRelPath
        });
        // Add new diff in the buffer
        this.isRename = true;
        this.addPathToConfig(newRelPath, oldRelPath);
        this.addDiff(newRelPath, diff);
    }

    handleDirectoryRenameDiffs = (oldPath, newPath) => {
        // No need to skip repos here as it is for specific repo
        this.isRename = true;
        const repoPath = this.repoPath;
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const that = this;
        const walker = walk.walk(newPath);
        walker.on("file", function (root, fileStats, next) {
            const newFilePath = path.join(root, fileStats.name);
            const oldFilePath = newFilePath.replace(newPath, oldPath);
            const oldRelPath = oldFilePath.split(path.join(repoPath, path.sep))[1];
            const newRelPath = newFilePath.split(path.join(repoPath, path.sep))[1];
            const diff = JSON.stringify({
                'old_rel_path': oldRelPath,
                'new_rel_path': newRelPath
            });
            that.addPathToConfig(newRelPath, oldRelPath);
            that.addDiff(newRelPath, diff);
            next();
        });
    };

}

