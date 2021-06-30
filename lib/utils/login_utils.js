'use babel';

import fs from "fs";
import express from "express";
import detectPort from "detect-port";
import querystring from 'querystring';
import jwt_decode from "jwt-decode";
import yaml from 'js-yaml';

import { readYML } from './common';
import { API_USERS, Auth0URLs, NOTIFICATION, USER_PATH } from "../constants";
import { repoIsNotSynced } from "./event_utils";
import { showConnectRepo } from "./notifications";

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


export const initExpressServer = (port) => {
    // Create an express server
    const expressApp = express();

    // define a route handler for the default home page
    expressApp.get("/", async (req, res) => {
        if (!req.query.code) { 
            res.send(NOTIFICATION.LOGIN_SUCCESS); 
            return;
        }
        await handleRedirect(req, port);
        res.send(NOTIFICATION.LOGIN_SUCCESS);
    });

    // start the Express server
    expressApp.listen(port, () => {
        console.log(`server started at ${createRedirectUri(port)}`);
    });
};

export const redirectToBrowser = (port, skipAskConnect = false) => {
    const authorizeUrl = createAuthorizeUrl(port, skipAskConnect);
    shell.openExternal(authorizeUrl);
};

export async function handleRedirect(req, port) {
    const json = await authorizeUser(req, port);
    if (json.error) {
        return;
    }
    // create user
    await createUser(json.response, json.skipAskConnect);
}

export function createRedirectUri(port) {
    return `${Auth0URLs.REDIRECT_URI}:${port}`;
}

export const createAuthorizeUrl = (port, skipAskConnect=false) => {
    // response_type=code&client_id=clientId&redirect_uri=http://localhost:8080&scope=openid%20profile%20email
    const params = {
        response_type: "code",
        client_id: Auth0URLs.CLIENT_KEY,
        redirect_uri: createRedirectUri(port),
        scope: "openid profile email",
        state: querystring.stringify( { skipAskConnect })
    };
    const queryParams = querystring.stringify(params);
    return `${Auth0URLs.AUTHORIZE}?${queryParams}`;
};

export const authorizeUser = async (req, port) => {
    let error = '';
    const redirectUri = createRedirectUri(port);
    const authorizationCode = req.query.code;
    const skipAskConnect = req.query.state.split("skipAskConnect=")[1] === 'true';
    const data = new URLSearchParams();
    data.append('grant_type', 'authorization_code');
    data.append('client_id', Auth0URLs.CLIENT_KEY);
    data.append('client_secret', Auth0URLs.CLIENT_SECRET);
    data.append('code', authorizationCode);
    data.append('redirect_uri', redirectUri);
    const response = await fetch(Auth0URLs.GET_TOKEN, {
            method: 'POST',
            headers: {'content-type': 'application/x-www-form-urlencoded'},
            body: data.toString()
        }
    )
        .then(res => res.json())
        .then(json => json)
        .catch(err => error = err);

    return {
        response,
        error,
        skipAskConnect
    };
};

export const createUser = async (response, skipAskConnect=false) => {
    let error = "";
    let user = {};
    const accessToken = response.access_token;
    user = jwt_decode(response.id_token);
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
    if (!repoPath) { return; }

	if (repoIsNotSynced(repoPath)) { 
        // Show notification to user to Sync the repo
        showConnectRepo(repoPath, user.email, accessToken, 0, skipAskConnect);
    }
};

export const logout = async (port) => {
    let error = "";
    const response = await fetch(
        `${Auth0URLs.LOGOUT}&client_id=${Auth0URLs.CLIENT_KEY}`
        )
        .then(res => res)
        .then(json => json)
        .catch(err => error = err);

    return {
        response,
        error
    };
};
