'use babel';

import fs from 'fs';
import path from 'path';
import getBranchName from 'current-git-branch';

import {
    DEFAULT_BRANCH,
    GITIGNORE,
    NOTIFICATION,
    SYNCIGNORE,
    getPublicPrivateMsg,
    SYNC_IGNORE_FILE_DATA
} from "../constants";
import {isRepoActive, readFile, readYML} from "../utils/common";
import {checkServerDown, getUserForToken} from "../utils/api_utils";
import {initUtils} from './utils';
import {askAndTriggerSignUp} from '../utils/auth_utils';
import {generateSettings} from "../settings";
import {pathUtils} from "../utils/path_utils";


export const syncRepo = async (repoPath, accessToken, viaDaemon = false, isSyncingBranch = false) => {
    /* Syncs a repo with CodeSync */
    const isServerDown = await checkServerDown();

    if (!viaDaemon && isServerDown) {
        atom.notifications.addError(NOTIFICATION.SERVICE_NOT_AVAILABLE);
        return;
    }

    let user = {email: "", plan: {}};
    if (!isServerDown) {
        // Validate access token
        const json = await getUserForToken(accessToken);
        if (!json.isTokenValid) {
            askAndTriggerSignUp();
            return;
        }
        user = json.response;
    }

    const settings = generateSettings();
    const repoName = path.basename(repoPath);
    const branch = getBranchName({altPath: repoPath}) || DEFAULT_BRANCH;
    const configJSON = readYML(settings.CONFIG_PATH);
    const isRepoSynced = isRepoActive(configJSON, repoPath);

    if (isRepoSynced && !isSyncingBranch && !viaDaemon) {
        atom.notifications.addWarning(`Repo is already in sync with branch: ${branch}`);
        return;
    }

    if (!isServerDown && !isSyncingBranch && !isRepoSynced && user.repo_count >= user.plan.REPO_COUNT) {
        atom.notifications.addError(NOTIFICATION.UPGRADE_PLAN, {
            dismissable: true
        });
        return;
    }

    const syncignorePath = path.join(repoPath, SYNCIGNORE);
    const syncignoreExists = fs.existsSync(syncignorePath);

    let syncignoreData = "";
    if (syncignoreExists) {
        syncignoreData = readFile(syncignorePath);
    } else {
        fs.writeFileSync(syncignorePath, SYNC_IGNORE_FILE_DATA);
    }

    const gitignorePath = path.join(repoPath, GITIGNORE);
    const gitignoreExists = fs.existsSync(gitignorePath);
    if ((!syncignoreExists || (syncignoreExists && !syncignoreData)) && gitignoreExists && !viaDaemon) {
        fs.copyFileSync(gitignorePath, syncignorePath);
    }

    // Open .syncignore and ask for user input for Continue/Cancel
    if (viaDaemon) {
        await postSyncignoreUpdated(repoPath, repoName, branch, user, accessToken, viaDaemon,
			isRepoSynced, isSyncingBranch);
        return;
    }
    // Opening .syncignore
    atom.workspace.open(syncignorePath);
    await postSyncignoreUpdated(repoPath, repoName, branch, user, accessToken, viaDaemon,
        isRepoSynced, isSyncingBranch);
}

const postSyncignoreUpdated = async (repoPath, repoName, branch, user, accessToken, viaDaemon,
									 isRepoSynced, isSyncingBranch = false) => {
    if (!viaDaemon && isRepoSynced) {
        atom.notifications.addInfo(`Branch: ${branch} is being synced for the repo: ${repoName}`);
    }

    // Only ask for public/private in case of Repo Sync. Do not ask for Branch Sync.
    if (viaDaemon && isRepoSynced && isSyncingBranch) {
        await postClickVisibility(repoPath, repoName, branch, user, accessToken, true, viaDaemon,
			isRepoSynced, null, isSyncingBranch)
        return;
    }

    askPublicOrPrivate(repoPath, repoName, branch, user, accessToken, viaDaemon, isRepoSynced);
};


export const askPublicOrPrivate = (repoPath, repoName, branch, user, accessToken, viaDaemon, isRepoSynced) => {
    const msg = getPublicPrivateMsg(repoPath);
    const notification = atom.notifications.addInfo(
        msg, {
            buttons: [
                {
                    text: NOTIFICATION.PUBLIC,
                    onDidClick: () => postClickVisibility(repoPath, repoName, branch, user, accessToken,
                        true, viaDaemon, isRepoSynced, notification)
                },
                {
                    text: NOTIFICATION.PRIVATE,
                    onDidClick: () => postClickVisibility(repoPath, repoName, branch, user, accessToken,
                        false, viaDaemon, isRepoSynced, notification)
                },
            ],
            dismissable: true
        });
};


export const postClickVisibility = async (repoPath, repoName, branch, user, accessToken, isPublic,
								   viaDaemon, isRepoSynced, notification = null,
								   isSyncingBranch = false) => {
    if (notification) {
        notification.dismiss();
    }
    const initUtilsObj = new initUtils(repoPath);
    const pathUtilsObj = new pathUtils(repoPath, branch);

    // get item paths to upload and copy in respective repos
    const itemPaths = initUtilsObj.getSyncablePaths(user.plan, isSyncingBranch);
    const filePaths = itemPaths.map(itemPath => itemPath.file_path);

    // copy files to .originals repo
    const originalsRepoBranchPath = pathUtilsObj.getOriginalsRepoBranchPath();
    initUtilsObj.copyFilesTo(filePaths, originalsRepoBranchPath);

    // copy files to .shadow repo
    const shadowRepoBranchPath = pathUtilsObj.getShadowRepoBranchPath();
    initUtilsObj.copyFilesTo(filePaths, shadowRepoBranchPath);

    // Upload repo/branch
    await initUtilsObj.uploadRepo(branch, accessToken, itemPaths, isPublic, isRepoSynced, viaDaemon, user.email);
}
