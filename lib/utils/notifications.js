'use babel';
import { NOTIFICATION } from '../constants';
import { syncRepo } from '../init/init_handler';
import { readYML } from './common';
import { logout, redirectToBrowser } from './auth_utils';
import {generateSettings} from "../settings";


export const showSignUpButtons = () => {
    const notification = atom.notifications.addInfo(NOTIFICATION.WELCOME_MSG, {
		buttons: [
			{
				text: NOTIFICATION.JOIN,
                onDidClick: () => {
                    notification.dismiss();
                    redirectToBrowser()
                }
			}
        ],
        dismissable: true
	});
}

export const showSuccessfullyAuthenticated = () => {
    atom.notifications.addInfo( NOTIFICATION.AUTHENTICATED_WITH_NO_REPO_OPENED, {
        dismissable: true
	});
}

export const showConnectRepo = (repoPath, email="", accessToken="") => {
    const skipAskConnect = global.skipAskConnect;
	if (skipAskConnect && email && accessToken) {
		syncRepo(repoPath, accessToken);
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
                        await syncRepo(repoPath, accessToken);
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
    const settings = generateSettings();
    const users = readYML(settings.USER_PATH);
    const accounts = [];
    Object.keys(users).forEach(key => {
        const user = users[key];
        if (user.access_token) {
            accounts.push({ email: key, access_token: user.access_token });
        }
    });

    if (accounts.length === 0) {
        atom.notifications.addError(NOTIFICATION.NO_VALID_ACCOUNT);
        return;
    }

    // By Default choosing first account
    const user = accounts[0];
    await syncRepo(repoPath, user.access_token);

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
