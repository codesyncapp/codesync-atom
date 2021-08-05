'use babel';

import fs from "fs";
import express from "express";
import detectPort from "detect-port";
import jwt_decode from "jwt-decode";
import yaml from 'js-yaml';

import { readYML } from './common';
import { API_USERS, Auth0URLs, NOTIFICATION, USER_PATH } from "../constants";
import { repoIsNotSynced } from "./event_utils";
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


export const initExpressServer = () => {
    // Create an express server
    const expressApp = express();

    // define a route handler for the default home page
    expressApp.get("/", async (req, res) => {
        res.send("OK");
    });

    // define a route handler for the authorization callback
    expressApp.get(Auth0URLs.LOGIN_SUCCESS_CALLBACK, async (req, res) => {
        await createUser(req.query.access_token, req.query.id_token);
        res.send(NOTIFICATION.LOGIN_SUCCESS);
    });

    // start the Express server
    expressApp.listen(global.port, () => {
        console.log(`server started at ${port}`);
    });
};

export const createRedirectUri = () => {
    const port = global.port;
    return `http://localhost:${port}${Auth0URLs.LOGIN_SUCCESS_CALLBACK}`;
};

export const redirectToBrowser = (skipAskConnect = false) => {
    global.skipAskConnect = skipAskConnect;
    const redirectUri = createRedirectUri();
    const authorizeUrl = `${Auth0URLs.AUTHORIZE}?redirect_uri=${redirectUri}`;
    shell.openExternal(authorizeUrl);
};

export const createUser = async (accessToken, idToken) => {
    let error = "";
    let user = {};
    user = jwt_decode(idToken);
    const userResponse = await fetch(API_USERS, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'Authorization': `Basic ${accessToken}`
            },
            body: JSON.stringify(user)
        }
    )
        .then(res => res.json())
        .then(json => json)
        .catch(err => error = err);

    if (error || 'error' in userResponse) {
        atom.notifications.addError(NOTIFICATION.LOGIN_FAILED);
        return;
    }

    // Save access token of user against email in user.yml
    const users = readYML(USER_PATH) || {};
    if (user.email in users) {
        users[user.email].access_token = accessToken;
    } else {
        users[user.email] = {access_token: accessToken};
    }
    fs.writeFileSync(USER_PATH, yaml.safeDump(users));

    const repoPath = atom.project.getPaths()[0];

    if (!repoPath) { showSuccessfullyAuthenticated(); }

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
