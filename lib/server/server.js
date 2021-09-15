'use babel';

import path from "path";
import express from "express";
import { createUser } from "../utils/auth_utils";
import {
    Auth0URLs,
    staticFiles
} from "../constants";

export const initExpressServer = () => {
    // Create an express server
    const expressApp = express();

    const staticPath = path.join(__dirname, 'static');
    expressApp.use(express.static(staticPath));

    // define a route handler for the default home page
    expressApp.get("/", async (req, res) => {
        res.send("OK");
    });

    // define a route handler for the authorization callback
    expressApp.get(Auth0URLs.LOGIN_CALLBACK_PATH, async (req, res) => {
        const files = new staticFiles(__dirname);
        try {
            await createUser(req.query.access_token, req.query.id_token);
            res.sendFile(files.LOGIN_SUCCESS);
        } catch (e) {
            res.sendFile(files.LOGIN_FAILURE);
        }
    });

    // start the Express server
    expressApp.listen(global.port, () => {
        console.log(`server started at ${global.port}`);
    });
};
