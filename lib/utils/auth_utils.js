'use babel';

import fs from "fs";
import yaml from 'js-yaml';
import detectPort from "detect-port";

import { readYML } from './common';
import {
    Auth0URLs,
    NOTIFICATION
} from "../constants";
import { repoIsNotSynced } from "../events/utils";
import { generateSettings } from "../settings";
import { createUserWithApi } from "./api_utils";
import { showConnectRepo, showSuccessfullyAuthenticated } from "./notifications";

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

export const createUser = async (accessToken, idToken) => {
    const userResponse = await createUserWithApi(accessToken, idToken);
    if (userResponse.error) {
        atom.notifications.addError(NOTIFICATION.LOGIN_FAILED);
        return;
    }

    const settings = generateSettings();
    const user = userResponse.user;

    // Save access token of user against email in user.yml
    const users = readYML(settings.USER_PATH) || {};
    if (user.email in users) {
        users[user.email].access_token = accessToken;
    } else {
        users[user.email] = {access_token: accessToken};
    }
    fs.writeFileSync(settings.USER_PATH, yaml.safeDump(users));

    const repoPath = atom.project.getPaths()[0];

    if (!repoPath) {
        return showSuccessfullyAuthenticated();
    }

	if (repoIsNotSynced(repoPath)) {
        // Show notification to user to Sync the repo
        showConnectRepo(repoPath, user.email, accessToken);
    }
};

export const logout = () => {
    const redirectUri = createRedirectUri();
    const params = new URLSearchParams({
        redirect_uri: redirectUri
    });
    const logoutUrl = `${Auth0URLs.LOGOUT}?${params}`;
    shell.openExternal(logoutUrl);
    return logoutUrl;
};

export const askAndTriggerSignUp = () => {
    atom.notifications.addWarning(NOTIFICATION.AUTHENTICATION_FAILED, {
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
