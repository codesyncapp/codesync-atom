'use babel';

import fs from 'fs';
import path from 'path';

import {
    GITIGNORE,
    NOTIFICATION,
    SYNCIGNORE,
    getPublicPrivateMsg,
    SYNC_IGNORE_FILE_DATA
} from "../constants";
import {getBranch, isRepoActive, readFile, readYML} from "../utils/common";
import {checkServerDown, getUserForToken} from "../utils/api_utils";
import {initUtils} from './utils';
import {askAndTriggerSignUp} from '../utils/auth_utils';
import {generateSettings} from "../settings";
import {pathUtils} from "../utils/path_utils";


export class initHandler {

    constructor(repoPath, accessToken, viaDaemon = false) {
        this.repoPath = repoPath;
        this.accessToken = accessToken;
        // This is set True via daemon
        this.viaDaemon = viaDaemon;
        this.branch = getBranch(this.repoPath);
    }

    syncRepo = async () => {
        /* Syncs a repo with CodeSync */
        const isServerDown = await checkServerDown();

        if (!this.viaDaemon && isServerDown) {
            atom.notifications.addError(NOTIFICATION.SERVICE_NOT_AVAILABLE);
            return;
        }

        let user = {email: "", plan: {}};
        if (!isServerDown) {
            // Validate access token
            const json = await getUserForToken(this.accessToken);
            if (!json.isTokenValid) {
                askAndTriggerSignUp();
                return;
            }
            user = json.response;
        }

        const settings = generateSettings();
        const configJSON = readYML(settings.CONFIG_PATH);
        const isRepoSynced = isRepoActive(configJSON, this.repoPath);

        if (isRepoSynced && !this.viaDaemon) {
            atom.notifications.addWarning(`Repo is already in sync with branch: ${this.branch}`);
            return;
        }

        if (!isServerDown && !isRepoSynced && !this.viaDaemon && user.repo_count >= user.plan.REPO_COUNT) {
            atom.notifications.addError(NOTIFICATION.UPGRADE_PLAN, {
                dismissable: true
            });
            return;
        }

        const syncignorePath = path.join(this.repoPath, SYNCIGNORE);
        const syncignoreExists = fs.existsSync(syncignorePath);

        let syncignoreData = "";
        if (syncignoreExists) {
            syncignoreData = readFile(syncignorePath);
        } else {
            fs.writeFileSync(syncignorePath, SYNC_IGNORE_FILE_DATA);
        }

        const gitignorePath = path.join(this.repoPath, GITIGNORE);
        const gitignoreExists = fs.existsSync(gitignorePath);
        if ((!syncignoreExists || (syncignoreExists && !syncignoreData)) && gitignoreExists && !this.viaDaemon) {
            fs.copyFileSync(gitignorePath, syncignorePath);
        }

        // Open .syncignore and ask for user input for Continue/Cancel
        if (this.viaDaemon) {
            await this.postClickVisibility(user, false);
            return;
        }
        // Opening .syncignore
        atom.workspace.open(syncignorePath);
        this.askPublicOrPrivate(user);
    }

    askPublicOrPrivate = (user) => {
        const msg = getPublicPrivateMsg(this.repoPath);
        const notification = atom.notifications.addInfo(
            msg, {
                buttons: [
                    {
                        text: NOTIFICATION.PUBLIC,
                        onDidClick: () => this.postClickVisibility(user, true, notification)
                    },
                    {
                        text: NOTIFICATION.PRIVATE,
                        onDidClick: () => this.postClickVisibility(user, false, notification)
                    },
                ],
                dismissable: true
            });
    };

    postClickVisibility = async (user, isPublic, notification = null) => {
        if (notification) {
            notification.dismiss();
        }
        const initUtilsObj = new initUtils(this.repoPath, this.viaDaemon);

        // get item paths to upload and copy in respective repos
        const itemPaths = initUtilsObj.getSyncablePaths(user.plan);
        const filePaths = itemPaths.map(itemPath => itemPath.file_path);

        const pathUtilsObj = new pathUtils(this.repoPath, this.branch);
        // copy files to .originals repo
        const originalsRepoBranchPath = pathUtilsObj.getOriginalsRepoBranchPath();
        initUtilsObj.copyFilesTo(filePaths, originalsRepoBranchPath);

        // copy files to .shadow repo
        const shadowRepoBranchPath = pathUtilsObj.getShadowRepoBranchPath();
        initUtilsObj.copyFilesTo(filePaths, shadowRepoBranchPath);

        // Upload repo/branch
        await initUtilsObj.uploadRepo(this.branch, this.accessToken, itemPaths, isPublic, user.email);
    }

}

