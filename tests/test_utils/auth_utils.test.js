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
} from "../../lib/utils/auth_utils";
import {Auth0URLs, NOTIFICATION} from "../../lib/constants";
import {
    addUser,
    buildAtomEnv,
    getUserFilePath,
    INVALID_TOKEN_JSON,
    randomBaseRepoPath,
    randomRepoPath,
    TEST_EMAIL,
    waitFor
} from "../helpers/helpers";
import { readYML } from "../../lib/utils/common";
import { initExpressServer } from "../../lib/server/server";
import { CodeSyncState, CODESYNC_STATES } from "../../lib/utils/state_utils";

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
    let userFilePath = '';
    const baseRepoPath = randomBaseRepoPath();

    beforeEach(() => {
        buildAtomEnv();
        untildify.mockReturnValue(baseRepoPath);
        fs.mkdirSync(baseRepoPath, {recursive: true});
        userFilePath = addUser(baseRepoPath);
    });

    afterEach(() => {
        fs.rmSync(baseRepoPath, { recursive: true, force: true });
    });

    test("Verify Logout URL",  async () => {
        const logoutUrl = logout();
        expect(logoutUrl.startsWith(Auth0URLs.LOGOUT)).toBe(true);
        // Verify user has been marked as inActive in user.yml
        const users = readYML(userFilePath);
        expect(users[TEST_EMAIL].is_active).toBe(false);
        await waitFor(1);
        expect(atom.notifications.addInfo).toHaveBeenCalledTimes(1);
        expect(atom.notifications.addInfo.mock.calls[0][0]).toStrictEqual(NOTIFICATION.LOGGED_OUT_SUCCESSFULLY);
        CodeSyncState.get(CODESYNC_STATES.USER_EMAIL, TEST_EMAIL);
    });
});


describe("createUser",  () => {
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
        await createUser("TOKEN", repoPath);
        expect(atom.notifications.addError).toHaveBeenCalledTimes(1);
        expect(atom.notifications.addError.mock.calls[0][0]).toStrictEqual(NOTIFICATION.LOGIN_FAILED);
        const options = atom.notifications.addError.mock.calls[0][1];
        expect(options).toBeFalsy();
        expect(CodeSyncState.get(CODESYNC_STATES.USER_EMAIL)).toBeFalsy();
    });

    test("with valid token and user not in user.yml", async () => {
        atom.project.getPaths.mockReturnValue([repoPath]);
        const user = {"user": {"id": 1, "email": TEST_EMAIL}};
        fetchMock.mockResponseOnce(JSON.stringify(user));
        global.skipAskConnect = false;
        await createUser("TOKEN", repoPath);
        const users = readYML(userFilePath);
        expect(TEST_EMAIL in users).toBe(true);
        expect(atom.project.getPaths).toHaveBeenCalledTimes(2);
        expect(CodeSyncState.get(CODESYNC_STATES.USER_EMAIL)).toStrictEqual(TEST_EMAIL);
    });

    test("with user in user.yml", async () => {
        atom.project.getPaths.mockReturnValue([repoPath]);
        let users = {};
        users[TEST_EMAIL] = {access_token: "abc"};
        fs.writeFileSync(userFilePath, yaml.safeDump(users));
        const user = {"user": {"id": 1, "email": TEST_EMAIL}};
        fetchMock.mockResponseOnce(JSON.stringify(user));
        await createUser("TOKEN", repoPath);
        expect(atom.project.getPaths).toHaveBeenCalledTimes(2);
        users = readYML(userFilePath);
        expect(TEST_EMAIL in users).toBe(true);
        expect(atom.notifications.addInfo).toHaveBeenCalledTimes(1);
        expect(atom.notifications.addInfo.mock.calls[0][0]).toStrictEqual(NOTIFICATION.CONNECT_AFTER_JOIN);
        const options = atom.notifications.addInfo.mock.calls[0][1];
        expect(options.buttons).toHaveLength(2);
        expect(options.buttons[0].text).toStrictEqual(NOTIFICATION.CONNECT);
        expect(options.buttons[1].text).toStrictEqual(NOTIFICATION.IGNORE);
        expect(options.dismissable).toBe(true);
        expect(CodeSyncState.get(CODESYNC_STATES.REPO_IS_IN_SYNC)).toBe(false);
        expect(CodeSyncState.get(CODESYNC_STATES.USER_EMAIL)).toStrictEqual(TEST_EMAIL);
    });

    test("with no repoPath", async () => {
        atom.project.getPaths.mockReturnValue([undefined]);
        let users = {};
        users[TEST_EMAIL] = {access_token: "abc"};
        fs.writeFileSync(userFilePath, yaml.safeDump(users));
        const user = {"user": {"id": 1, "email": TEST_EMAIL}};
        fetchMock.mockResponseOnce(JSON.stringify(user));
        await createUser("TOKEN", repoPath);
        expect(atom.project.getPaths).toHaveBeenCalledTimes(2);
        users = readYML(userFilePath);
        expect(TEST_EMAIL in users).toBe(true);
        expect(atom.notifications.addInfo).toHaveBeenCalledTimes(1);
        expect(atom.notifications.addInfo.mock.calls[0][0]).toStrictEqual(NOTIFICATION.AUTHENTICATED_WITH_NO_REPO_OPENED);
        const options = atom.notifications.addInfo.mock.calls[0][1];
        expect(options.buttons).toBeFalsy();
        expect(options.dismissable).toBe(true);
        expect(CodeSyncState.get(CODESYNC_STATES.USER_EMAIL)).toStrictEqual(TEST_EMAIL);
    });
});


describe("askAndTriggerSignUp",  () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("askAndTriggerSignUp", () => {
        askAndTriggerSignUp();
        expect(atom.notifications.addError).toHaveBeenCalledTimes(1);
        expect(atom.notifications.addError.mock.calls[0][0]).toStrictEqual(NOTIFICATION.AUTHENTICATION_FAILED);
        const options = atom.notifications.addError.mock.calls[0][1];
        expect(options.buttons).toHaveLength(1);
        expect(options.buttons[0].text).toStrictEqual(NOTIFICATION.LOGIN);
        expect(options.dismissable).toBe(true);
    });
});
