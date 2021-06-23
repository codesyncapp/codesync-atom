'use babel';

const { shell } = require('electron');

import { NOTIFICATION_CONSTANTS } from '../constants';
import { createAuthorizeUrl } from './login_utils';


const authorizeUser = (port) => {
    shell.openExternal(createAuthorizeUrl(port))
}

export function showSignUpButtons(port) {
    atom.notifications.addInfo(NOTIFICATION_CONSTANTS.WELCOME_MSG, {

		buttons: [
			{
				text: NOTIFICATION_CONSTANTS.JOIN,
                onDidClick: () => authorizeUser(port)
			}
        ],
        dismissable: true
	});
}
