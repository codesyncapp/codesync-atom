'use babel';
import { NOTIFICATION, USER_PATH } from '../constants';
import { syncRepo } from '../init_handler';
import { readYML } from './common';
import { logout, redirectToBrowser } from './login_utils';


export const showSignUpButtons = (port) => {
    atom.notifications.addInfo(NOTIFICATION.WELCOME_MSG, {
		buttons: [
			{
				text: NOTIFICATION.JOIN,
                onDidClick: () => redirectToBrowser(port)
			}
        ],
        dismissable: true
	});
}

export const showConnectRepo = (repoPath, email="", accessToken="", port=0, skipAskConnect=false) => { 
	if (skipAskConnect && email && accessToken) {
		syncRepo(repoPath, accessToken, email);
		return;
	}
	const msg = email ? NOTIFICATION.CONNECT_AFTER_JOIN : NOTIFICATION.CONNECT_REPO;
	atom.notifications.addInfo(msg, {
        buttons: [
			{
				text: NOTIFICATION.CONNECT,
                onDidClick: async () => {
                    if (email && accessToken) {
                        await syncRepo(repoPath, accessToken, email);
                        return;
                    }
        
                    // Check if access token is present against users
                    const users = readYML(USER_PATH);
                    const validUsers = [];
                    Object.keys(users).forEach(key => {
                        const user = users[key];
                        if (user.access_token) {
                            validUsers.push({ email: key, access_token: user.access_token });
                        }
                    });
        
                    if (validUsers.length === 0) {
                        atom.notifications.addError(NOTIFICATION.NO_VALID_ACCOUNT);
                        return;
                    }
        
                    showChooseAccount(repoPath, validUsers, port);
        
                }
			},
            {
				text: NOTIFICATION.IGNORE
			}
        ],
        dismissable: true
    });
};

export const showChooseAccount = (repoPath, accounts, port) => {
	const emails = accounts.map(account => account.email);
	const options = [...emails, NOTIFICATION.USE_DIFFERENT_ACCOUNT];
    const buttons = options.map((option) => {
        if (option ===  NOTIFICATION.USE_DIFFERENT_ACCOUNT) {
            return {
                text: option,
                onDidClick: async () => {
                    await logout(port);
                    redirectToBrowser(port, true);
                    return;    
                }
            }
        }
        return {
            text: option,
            onDidClick: async() => await postSelectionChooseAccount(repoPath, accounts, option)
        }
    });
    atom.notifications.addInfo(
		NOTIFICATION.CHOOSE_ACCOUNT, {
            buttons,
            dismissable: true
    });
};

const postSelectionChooseAccount = async (repoPath, accounts, selection) => {
    const index = accounts.findIndex(user => user.email === selection);
    const user = accounts[index];
    // We have token, repoPath Trigger Init
    await syncRepo(repoPath, user.access_token, user.email);
};
