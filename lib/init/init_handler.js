'use babel';

import fs from 'fs';
import path from 'path';
import getBranchName from 'current-git-branch';

import {
    DEFAULT_BRANCH,
    GITIGNORE,
    NOTIFICATION,
    SYNCIGNORE,
    getPublicPrivateMsg
} from "../constants";
import {isRepoActive, readFile, readYML} from "../utils/common";
import {checkServerDown, getUserForToken} from "../utils/api_utils";
import {initUtils} from './utils';
import {askAndTriggerSignUp} from '../utils/auth_utils';
import {generateSettings} from "../settings";


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

    const splitPath = repoPath.split('/');
    const repoName = splitPath[splitPath.length - 1];
    const branch = getBranchName({altPath: repoPath}) || DEFAULT_BRANCH;
    const configJSON = readYML(settings.CONFIG_PATH);
    const isRepoSynced = isRepoActive(configJSON, repoPath);
    const isBranchSynced = isRepoSynced && branch in configJSON.repos[repoPath].branches;

    if (isRepoSynced && isBranchSynced && !viaDaemon) {
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
        fs.writeFileSync(syncignorePath, "");
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
    atom.workspace.open(`${repoPath}/${SYNCIGNORE}`);
    const msg = syncignoreExists ? NOTIFICATION.UPDATE_SYNCIGNORE : NOTIFICATION.SYNC_IGNORE_CREATED;
    const notification = atom.notifications.addInfo(msg,
        {
            buttons: [
                {
                    text: NOTIFICATION.CONTINUE,
                    onDidClick: async () => {
                        notification.dismiss();
                        await postSyncignoreUpdated(repoPath, repoName, branch, user, accessToken,
							viaDaemon, isRepoSynced, isSyncingBranch)
                    }
                }
            ],
            dismissable: true
        });
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

    askPublicOrPrivate(repoPath);
};


export const askPublicOrPrivate = (repoPath) => {
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
    const settings = generateSettings();
    const initUtilsObj = new initUtils(repoPath);

    // get item paths to upload and copy in respective repos
    const itemPaths = initUtilsObj.getSyncablePaths(user.plan, isSyncingBranch);
    const filePaths = itemPaths.map(itemPath => itemPath.file_path);
    const originalsRepoBranchPath = path.join(settings.ORIGINALS_REPO, path.join(repoPath, branch));

    // copy files to .originals repo
    initUtilsObj.copyFilesTo(filePaths, originalsRepoBranchPath);

    const shadowRepoBranchPath = path.join(settings.SHADOW_REPO, path.join(repoPath, branch));
    // copy files to .shadow repo
    initUtilsObj.copyFilesTo(filePaths, shadowRepoBranchPath);

    // Upload repo/branch
    await initUtilsObj.uploadRepo(branch, accessToken, itemPaths, isPublic, isRepoSynced, viaDaemon, user.email);
}
