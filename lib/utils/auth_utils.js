'use babel';

import fs from "fs";
import yaml from 'js-yaml';
import detectPort from "detect-port";

import { readYML } from './common';
import {
    Auth0URLs,
    getRepoInSyncMsg,
    NOTIFICATION
} from "../constants";
import { isRepoSynced } from "../events/utils";
import { generateSettings } from "../settings";
import { createUserWithApi } from "./api_utils";
import { showConnectRepo, showSuccessfullyAuthenticated } from "./notifications";
import { trackRepoHandler } from "../handlers/commands_handler";
import { pathUtils } from "./path_utils";

const { shell } = require('electron');


export const isPortAvailable = async (port) => {
    return detectPort(port)
        .then(_port => {
            return port === _port;
        })
        .catch(err => {
            console.log(err);
            return false;
        });
};

export const createRedirectUri = () => {
    const port = global.port;
    return `http://localhost:${port}${Auth0URLs.LOGIN_CALLBACK_PATH}`;
};

export const redirectToBrowser = (skipAskConnect = false) => {
    global.skipAskConnect = skipAskConnect;
    const redirectUri = createRedirectUri();
    const authorizeUrl = `${Auth0URLs.AUTHORIZE}?redirect_uri=${redirectUri}`;
    shell.openExternal(authorizeUrl);
};

export const createUser = async (accessToken) => {
    const userResponse = await createUserWithApi(accessToken);
    if (userResponse.error) {
        atom.notifications.addError(NOTIFICATION.LOGIN_FAILED);
        return;
    }

    const settings = generateSettings();
    const userEmail = userResponse.email;

    // Save access token of user against email in user.yml
    const users = readYML(settings.USER_PATH) || {};
    if (userEmail in users) {
        users[userEmail].access_token = accessToken;
        users[userEmail].is_active = true;
    } else {
        users[userEmail] = {
            access_token: accessToken,
            is_active: true
        };
    }
    fs.writeFileSync(settings.USER_PATH, yaml.safeDump(users));

    const repoPath = pathUtils.getProjectPath();

    if (!repoPath) {
        return showSuccessfullyAuthenticated();
    }

	if (!isRepoSynced(repoPath)) {
        // Show notification to user to Sync the repo
        return showConnectRepo(repoPath, userEmail, accessToken);
    }
    // Show notification that repo is connected with CodeSync
    atom.notifications.addInfo(getRepoInSyncMsg(repoPath), {
        buttons: [
            {
                text: NOTIFICATION.TRACK_IT,
                onDidClick: trackRepoHandler
            }
        ],
        dismissable: true
    });
};

export const logout = () => {
    const redirectUri = createRedirectUri();
    const params = new URLSearchParams({
        redirect_uri: redirectUri
    });
    const logoutUrl = `${Auth0URLs.LOGOUT}?${params}`;
    shell.openExternal(logoutUrl);
    markUsersInactive();
    return logoutUrl;
};

const markUsersInactive = () => {
    // Mark all users as is_active=false in user.yml
    const settings = generateSettings();
    const users = readYML(settings.USER_PATH);
    Object.keys(users).forEach((email) => {
        users[email].is_active = false;
    });
    fs.writeFileSync(settings.USER_PATH, yaml.safeDump(users));
    setTimeout(() => {
        atom.notifications.addInfo(NOTIFICATION.LOGGED_OUT_SUCCESSFULLY);
    }, 1000);
};

export const askAndTriggerSignUp = () => {
    atom.notifications.addError(NOTIFICATION.AUTHENTICATION_FAILED, {
        buttons: [
            {
                text: NOTIFICATION.LOGIN,
                onDidClick: () => redirectToBrowser(true)
            }
            // ,
            // {
            //     text: NOTIFICATION.IGNORE,
            // }
        ],
        dismissable: true
    });
};
