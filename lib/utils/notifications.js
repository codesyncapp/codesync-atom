'use babel';

import { getRepoIsSyncIgnoredMsg, NOTIFICATION } from '../constants';
import { initHandler } from '../init/init_handler';
import { getActiveUsers } from './common';
import { redirectToBrowser } from './auth_utils';
import { CodeSyncState, CODESYNC_STATES } from "./state_utils";
import { trackRepoHandler } from '../handlers/commands_handler';

export const showSignUpButtons = () => {
    const notification = atom.notifications.addInfo(NOTIFICATION.WELCOME_MSG, {
		buttons: [
			{
				text: NOTIFICATION.JOIN,
                onDidClick: () => {
                    notification.dismiss();
                    redirectToBrowser();
                }
			}
        ],
        dismissable: true
	});
}

export const showSuccessfullyAuthenticated = () => {
    atom.notifications.addInfo(NOTIFICATION.AUTHENTICATED_WITH_NO_REPO_OPENED, {
        dismissable: true
	});
}

export const showConnectRepo = (repoPath, email="", accessToken="") => {
    CodeSyncState.set(CODESYNC_STATES.REPO_IS_IN_SYNC, false);
    const skipAskConnect = global.skipAskConnect;
	if (skipAskConnect && email && accessToken) {
        const handler = new initHandler(repoPath, accessToken);
        handler.syncRepo();
        global.skipAskConnect = false;
		return;
	}
    if (!repoPath) {
        atom.notifications.addInfo(NOTIFICATION.AUTHENTICATED_WITH_NO_REPO_OPENED, {
            dismissable: true
        });
        return;
    }
	const msg = email ? NOTIFICATION.CONNECT_AFTER_JOIN : NOTIFICATION.CONNECT_REPO;
	const notification = atom.notifications.addInfo(msg, {
        buttons: [
			{
				text: NOTIFICATION.CONNECT,
                onDidClick: async () => {
                    notification.dismiss();
                    if (email && accessToken) {
                        const handler = new initHandler(repoPath, accessToken);
                        await handler.syncRepo();
                        return;
                    }

                    await showChooseAccount(repoPath);
                }
			},
            {
				text: NOTIFICATION.IGNORE,
                onDidClick: () => notification.dismiss()
			}
        ],
        dismissable: true
    });
};

export const showChooseAccount = async (repoPath) => {
    // Check if access token is present against users
    const validUsers = getActiveUsers();
    if (validUsers.length === 0) {
        atom.notifications.addError(NOTIFICATION.NO_VALID_ACCOUNT);
        return;
    }
    // By Default choosing first account
    const user = validUsers[0];
    const handler = new initHandler(repoPath, user.access_token);
    await handler.syncRepo();
    return handler;
    // TODO: Option to choose different account
    // const emails = accounts.map(account => account.email);
	// const options = [...emails, NOTIFICATION.USE_DIFFERENT_ACCOUNT];
    //
    // const notification = atom.notifications.addInfo(
	// 	NOTIFICATION.CHOOSE_ACCOUNT, {
    //         buttons: options.map((option) => {
    //             if (option ===  NOTIFICATION.USE_DIFFERENT_ACCOUNT) {
    //                 return {
    //                     text: option,
    //                     onDidClick: async () => {
    //                         notification.dismiss();
    //                         return logout();
    //                     }
    //                 }
    //             }
    //             return {
    //                 text: option,
    //                 onDidClick: async() => {
    //                     notification.dismiss();
    //                     await postSelectionChooseAccount(repoPath, accounts, option)
    //                 }
    //             }
    //         }),
    //         dismissable: true
    // });
};

// const postSelectionChooseAccount = async (repoPath, accounts, selection) => {
//     const index = accounts.findIndex(user => user.email === selection);
//     const user = accounts[index];
//     // We have token, repoPath Trigger Init
//     await syncRepo(repoPath, user.access_token);
// };

export const showSyncIgnoredRepo = (repoPath) => {
	const msg = getRepoIsSyncIgnoredMsg(repoPath);
    atom.notifications.addInfo(msg, {
        buttons: [
			{
				text: NOTIFICATION.TRACK_PARENT_REPO,
                onDidClick: trackRepoHandler
			}
        ],
        dismissable: true
    });
};
