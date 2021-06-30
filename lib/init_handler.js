'use babel';

import fs from 'fs';
import path from 'path';
import getBranchName from 'current-git-branch';

import { CONFIG_PATH, DEFAULT_BRANCH, GITIGNORE, INVALID_TOKEN_MESSAGE, NOTIFICATION, 
	ORIGINALS_REPO, SHADOW_REPO, SYNCIGNORE } from "./constants";
import { readFile, readYML } from "./utils/common";
import { checkServerDown, getUserForToken } from "./utils/api_utils";
import { initUtils } from './utils/init_utils';
import { askPublicPrivate } from "./utils/notifications";


export const syncRepo = async (repoPath, accessToken, email, viaDaemon=false, isSyncingBranch=false) => {
	/* Syncs a repo with CodeSync */
	if (!viaDaemon) {
		const isServerDown = await checkServerDown();
		if (isServerDown) { 
			atom.notifications.addError(NOTIFICATION.SERVICE_NOT_AVAILABLE);
			return; 
		}
	}

	// Validate access token
	const json = await getUserForToken(accessToken);
	if (!json.isTokenValid) {
		if (viaDaemon) {
			console.log(INVALID_TOKEN_MESSAGE);
		} else {
			// Show error msg that token is invalid
			atom.notifications.addError(INVALID_TOKEN_MESSAGE);
			// TODO: Trigger sign up process
		}
		return;	
	}

	const user = json.response;

	let isPublic = false;
	let shouldExit = false;
	const splittedPath = repoPath.split('/');
	const repoName = splittedPath[splittedPath.length-1];
	const branch = getBranchName({ altPath: repoPath }) || DEFAULT_BRANCH;
	const configJSON = readYML(CONFIG_PATH);
    const isRepoSynced = repoPath in configJSON['repos'];
	const isBranchSynced = isRepoSynced && branch in configJSON.repos[repoPath].branches;

	if (isRepoSynced && isBranchSynced) {
		atom.notifications.addWarning(`Repo is already in sync with branch: ${branch}`);
		return;
	}

	if (!isRepoSynced && user.repo_count >= user.plan.REPO_COUNT) {
		atom.notifications.addError(NOTIFICATION.UPGRADE_PLAN);
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
	const gitignoreExists  = fs.existsSync(gitignorePath);
	if (!syncignoreExists || (syncignoreExists && !syncignoreData) && gitignoreExists && !viaDaemon) {
		fs.copyFileSync(gitignorePath, syncignorePath);
		// Notify the user that .syncignore was created from .syncignore
		atom.notifications.addInfo(`${SYNCIGNORE} was created from ${GITIGNORE}`);
	}

	// Open .syncignore and ask for user input for Continue/Cancel
	// TODO: Look into opening .syncignore and button selection if cancelled
    // if (!viaDaemon) {
	// 	// Opening .syncignore
	// 	const setting: vscode.Uri = vscode.Uri.parse("file:" + `${repoPath}/${SYNCIGNORE}`);
	// 	await vscode.workspace.openTextDocument(setting).then(async (a: vscode.TextDocument) => {
	// 		await vscode.window.showTextDocument(a, 1, false).then(async e => {
	// 			const selectedValue = await vscode.window.showInformationMessage(
	// 				NOTIFICATION.UPDATE_SYNCIGNORE, ...[
	// 				NOTIFICATION.CONTINUE, 
	// 				NOTIFICATION.CANCEL
	// 			]).then(selection => selection);

	// 			shouldExit = !selectedValue || selectedValue !== NOTIFICATION.CONTINUE;
	// 			if (shouldExit) {
	// 				vscode.window.showWarningMessage(NOTIFICATION.INIT_CANCELLED);
	// 				return;
	// 			}
	// 		});
	// 	});
	// }

	if (shouldExit) { return; }

	if (!viaDaemon && isRepoSynced) {
		atom.notifications.addInfo(`Branch: ${branch} is being synced for the repo: ${repoName}`);
	}

	// Only ask for public/private in case of Repo Sync. Do not ask for Branch Sync.
	if (!viaDaemon && !isRepoSynced) {
		isPublic = await askPublicPrivate();
	}

	// get item paths to upload and copy in respective repos
	const itemPaths = initUtils.getSyncablePaths(repoPath, user.plan);

	const originalsRepoBranchPath = path.join(ORIGINALS_REPO, path.join(repoPath, branch));
	if (!fs.existsSync(originalsRepoBranchPath)) {
		// copy files to .originals repo
		initUtils.copyFilesTo(repoPath, itemPaths, originalsRepoBranchPath);
	}

	const shadowRepoBranchPath = path.join(SHADOW_REPO, path.join(repoPath, branch));
	if (!fs.existsSync(shadowRepoBranchPath)) {
		// copy files to .shadow repo
		initUtils.copyFilesTo(repoPath, itemPaths, shadowRepoBranchPath);
	}

	// Upload repo/branch
	await initUtils.uploadRepo(repoPath, repoName, branch,  accessToken, isPublic, itemPaths, email, isRepoSynced, viaDaemon);
};
