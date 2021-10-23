'use babel';

import fetch from "node-fetch";
import jwt_decode from "jwt-decode";
import { API_HEALTHCHECK, API_USERS } from "../constants";


export const checkServerDown = async () => {
    let isDown = false;
    const response = await fetch(API_HEALTHCHECK)
        .then(res => res.json())
        .then(json => json)
        .catch(err => {
            isDown = true;
        });
    return isDown || !response.status;
};

export const getUserForToken = async (accessToken) => {
    let isTokenValid = false;
    const response = await fetch(
        API_USERS, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${accessToken}`
            },
        })
        .then(res => res.json())
        .then(json => json)
        .catch(err => {
            isTokenValid = false;
        });
    if (response) {
        isTokenValid = !("error" in response);
    }
    return {
        isTokenValid,
        response
    };
};

export const createUserWithApi = async (accessToken, idToken) => {
    let error = "";
    const user = jwt_decode(idToken);
    const response = await fetch(API_USERS, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${accessToken}`
            },
            body: JSON.stringify(user)
        }
    )
        .then(res => res.json())
        .then(json => json)
        .catch(err => error = err);

    if ("error" in response) {
        error = response.error;
    }

    return {
        user,
        error
    };
};
