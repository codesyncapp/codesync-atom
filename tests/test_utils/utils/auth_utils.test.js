import fs from "fs";
import yaml from "js-yaml";
import untildify from "untildify";
import fetchMock from "jest-fetch-mock";
import {
    askAndTriggerSignUp,
    createRedirectUri,
    createUser,
    isPortAvailable,
    logout,
    redirectToBrowser
} from "../../../lib/utils/auth_utils";
import {Auth0URLs, NOTIFICATION} from "../../../lib/constants";
import {
    buildAtomEnv,
    getUserFilePath,
    INVALID_TOKEN_JSON,
    randomBaseRepoPath,
    randomRepoPath,
    TEST_EMAIL
} from "../../helpers/helpers";
import { readYML } from "../../../lib/utils/common";
import { initExpressServer } from "../../../lib/server/server";

const { shell } = require('electron');


describe("isPortAvailable",  () => {
    test("random free port", async () => {
        expect(await isPortAvailable(59402)).toBe(true);
    });

    test("server port", async () => {
        expect(await isPortAvailable(8000)).toBe(false);
    });
});

describe("initExpressServer",  () => {
    test("initExpressServer",  () => {
        const port = 1234;
        global.port = port;
        initExpressServer();

        const refUrl = `http://localhost:${port}${Auth0URLs.LOGIN_CALLBACK_PATH}`;
        const url = createRedirectUri();
        expect(url).toEqual(refUrl);
    });
});

describe("createRedirectUri",  () => {
    test("createRedirectUri",  () => {
        const port = 1234;
        global.port = port;
        const refUrl = `http://localhost:${port}${Auth0URLs.LOGIN_CALLBACK_PATH}`;
        const url = createRedirectUri();
        expect(url).toEqual(refUrl);
    });
});

describe("redirectToBrowser",  () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("skipAskConnect=false",  () => {
        redirectToBrowser();
        expect(global.skipAskConnect).toBe(false);
        expect(shell.openExternal).toHaveBeenCalledTimes(1);

    });

    test("skipAskConnect=true",  () => {
        redirectToBrowser(true);
        expect(global.skipAskConnect).toBe(true);
        expect(shell.openExternal).toHaveBeenCalledTimes(1);
    });
});


describe("logout",  () => {
    test("Verify Logout URL",  () => {
        const logoutUrl = logout();
        expect(logoutUrl.startsWith(Auth0URLs.LOGOUT)).toBe(true);
    });
});


describe("createUser",  () => {
    const idToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InRlc3RAY29kZXN5bmMuY29tIn0.bl7QQajhg2IjPp8h0gzFku85qCrXQN4kThoo1AxB_Dc";
    const repoPath = randomRepoPath();
    const baseRepoPath = randomBaseRepoPath();
    const userFilePath = getUserFilePath(baseRepoPath);
    const userData = {"dummy_email": {access_token: "ABC"}};

    beforeEach(() => {
        fetch.resetMocks();
        jest.clearAllMocks();
        buildAtomEnv();
        untildify.mockReturnValue(baseRepoPath);
        fs.mkdirSync(baseRepoPath, {recursive: true});
        fs.mkdirSync(repoPath, {recursive: true});
        fs.writeFileSync(userFilePath, yaml.safeDump(userData));
    });

    afterEach(() => {
        fs.rmSync(repoPath, { recursive: true, force: true });
        fs.rmSync(baseRepoPath, { recursive: true, force: true });
    });

    test("with invalid token", async () => {
        fetchMock.mockResponseOnce(JSON.stringify(INVALID_TOKEN_JSON));
        await createUser("TOKEN", idToken, repoPath);
        expect(global.atom.notifications.addError).toHaveBeenCalledTimes(1);
        expect(global.atom.notifications.addError.mock.calls[0][0]).toStrictEqual(NOTIFICATION.LOGIN_FAILED);
        const options = global.atom.notifications.addError.mock.calls[0][1];
        expect(options).toBeFalsy();

    });

    test("with valid token and user not in user.yml", async () => {
        global.atom.project.getPaths.mockReturnValueOnce([repoPath]);
        const user = {"user": {"id": 1}};
        fetchMock.mockResponseOnce(JSON.stringify(user));
        global.skipAskConnect = false;
        await createUser("TOKEN", idToken, repoPath);
        const users = readYML(userFilePath);
        expect(TEST_EMAIL in users).toBe(true);
        expect(global.atom.project.getPaths).toHaveBeenCalledTimes(1);
    });

    test("with user in user.yml", async () => {
        global.atom.project.getPaths.mockReturnValueOnce([repoPath]);
        let users = {};
        users[TEST_EMAIL] = {access_token: "abc"};
        fs.writeFileSync(userFilePath, yaml.safeDump(users));
        const user = {"user": {"id": 1}};
        fetchMock.mockResponseOnce(JSON.stringify(user));
        await createUser("TOKEN", idToken, repoPath);
        expect(global.atom.project.getPaths).toHaveBeenCalledTimes(1);
        users = readYML(userFilePath);
        expect(TEST_EMAIL in users).toBe(true);
        expect(global.atom.notifications.addInfo).toHaveBeenCalledTimes(1);
        expect(global.atom.notifications.addInfo.mock.calls[0][0]).toStrictEqual(NOTIFICATION.CONNECT_AFTER_JOIN);
        const options = global.atom.notifications.addInfo.mock.calls[0][1];
        expect(options.buttons).toHaveLength(2);
        expect(options.buttons[0].text).toStrictEqual(NOTIFICATION.CONNECT);
        expect(options.buttons[1].text).toStrictEqual(NOTIFICATION.IGNORE);
        expect(options.dismissable).toBe(true);

    });

    test("with no repoPath", async () => {
        global.atom.project.getPaths.mockReturnValueOnce([undefined]);
        let users = {};
        users[TEST_EMAIL] = {access_token: "abc"};
        fs.writeFileSync(userFilePath, yaml.safeDump(users));
        const user = {"user": {"id": 1}};
        fetchMock.mockResponseOnce(JSON.stringify(user));
        await createUser("TOKEN", idToken, repoPath);
        expect(global.atom.project.getPaths).toHaveBeenCalledTimes(1);
        users = readYML(userFilePath);
        expect(TEST_EMAIL in users).toBe(true);
        expect(global.atom.notifications.addInfo).toHaveBeenCalledTimes(1);
        expect(global.atom.notifications.addInfo.mock.calls[0][0]).toStrictEqual(NOTIFICATION.AUTHENTICATED_WITH_NO_REPO_OPENED);
        const options = global.atom.notifications.addInfo.mock.calls[0][1];
        expect(options.buttons).toBeFalsy();
        expect(options.dismissable).toBe(true);
    });
});


describe("askAndTriggerSignUp",  () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("askAndTriggerSignUp", () => {
        askAndTriggerSignUp();
        expect(global.atom.notifications.addWarning).toHaveBeenCalledTimes(1);
        expect(global.atom.notifications.addWarning.mock.calls[0][0]).toStrictEqual(NOTIFICATION.AUTHENTICATION_FAILED);
        const options = global.atom.notifications.addWarning.mock.calls[0][1];
        expect(options.buttons).toHaveLength(1);
        expect(options.buttons[0].text).toStrictEqual(NOTIFICATION.LOGIN);
        expect(options.dismissable).toBe(true);
    });
});
