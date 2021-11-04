import fs from "fs";
import yaml from "js-yaml";
import untildify from "untildify";
import fetchMock from "jest-fetch-mock";

import {API_HEALTHCHECK, API_USERS} from "../../lib/constants";
import {checkServerDown, createUserWithApi, getUserForToken} from "../../lib/utils/api_utils";
import {
    getSeqTokenFilePath,
    getUserFilePath,
    INVALID_TOKEN_JSON,
    mkDir,
    randomBaseRepoPath
} from "../helpers/helpers";


describe('checkServerDown', () => {
    const baseRepoPath = randomBaseRepoPath();
    const userFilePath = getUserFilePath(baseRepoPath);
    const sequenceTokenFilePath = getSeqTokenFilePath(baseRepoPath);

    beforeEach(() => {
        fetch.resetMocks();
        jest.clearAllMocks();
        untildify.mockReturnValue(baseRepoPath);
        mkDir(baseRepoPath);
        fs.writeFileSync(userFilePath, yaml.safeDump({}));
        fs.writeFileSync(sequenceTokenFilePath, yaml.safeDump({}));

    });

    afterEach(() => {
        fs.rmdirSync(baseRepoPath, { recursive: true});
    });

    test("with status: true", async () => {
        fetchMock.mockResponseOnce(JSON.stringify({status: true}));
        const isServerDown = await checkServerDown();
        expect(isServerDown).toBe(false);
        expect(fetch.mock.calls[0][0]).toStrictEqual(API_HEALTHCHECK);
    });

    test("with status: false", async () => {
        fetchMock.mockResponseOnce(JSON.stringify({status: false}));
        const isServerDown = await checkServerDown();
        expect(isServerDown).toBe(true);
        expect(fetch.mock.calls[0][0]).toStrictEqual(API_HEALTHCHECK);
    });

    test("will null response", async () => {
        fetchMock.mockResponseOnce(null);
        const isServerDown = await checkServerDown();
        expect(isServerDown).toBe(true);
        expect(fetch.mock.calls[0][0]).toStrictEqual(API_HEALTHCHECK);
    });
});


describe("getUserForToken",  () => {
    beforeEach(() => {
        fetch.resetMocks();
    });

    const user = {
        "email": "dummy@email.cpm",
        "plan": {},
        "repo_count": 0
    };

    const assertAPICall = (token="ACCESS_TOKEN") => {
        expect(fetch.mock.calls[0][0]).toStrictEqual(API_USERS);
        const options = fetch.mock.calls[0][1];
        expect(options.headers).toStrictEqual({
            'Content-Type': 'application/json',
            'Authorization': `Basic ${token}`
        });
        return true;
    };

    test('should get auth error', async () => {
        fetchMock.mockResponseOnce(JSON.stringify(INVALID_TOKEN_JSON));
        const res = await getUserForToken("INVALID_TOKEN");
        expect(res.isTokenValid).toBe(false);
        // Assert API call
        expect(assertAPICall("INVALID_TOKEN")).toBe(true);
    });

    test('should fetch users', async () => {
        fetchMock.mockResponseOnce(JSON.stringify(user));
        const apiResponse = await getUserForToken("ACCESS_TOKEN");
        expect(apiResponse.isTokenValid).toBe(true);
        expect(apiResponse.response).toEqual(user);
        // Assert API call
        expect(assertAPICall()).toBe(true);
    });

    test('with null response', async () => {
        fetchMock.mockResponseOnce(null);
        const apiResponse = await getUserForToken("ACCESS_TOKEN");
        expect(apiResponse.isTokenValid).toBe(false);
        // Assert API call
        expect(assertAPICall()).toBe(true);
    });
});


describe("createUserWithApi",  () => {
    const idToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InRlc3RAY29kZXN5bmMuY29tIn0.bl7QQajhg2IjPp8h0gzFku85qCrXQN4kThoo1AxB_Dc";
    const decodedSample = {
        "email": "test@codesync.com"
    };

    beforeEach(() => {
        fetch.resetMocks();
    });

    const assertAPICall = (token="ACCESS_TOKEN") => {
        expect(fetch.mock.calls[0][0]).toStrictEqual(API_USERS);
        const options = fetch.mock.calls[0][1];
        expect(options.method).toStrictEqual("POST");
        expect(options.headers).toStrictEqual({
            'Content-Type': 'application/json',
            'Authorization': `Basic ${token}`
        });
        const body = JSON.parse(fetch.mock.calls[0][1].body);
        expect(body).toStrictEqual(decodedSample);
        return true;
    };

    const user = {
        "email": "dummy@email.cpm",
        "plan": {},
        "repo_count": 0
    };

    test('should get auth error', async () => {
        fetchMock.mockResponseOnce(JSON.stringify(INVALID_TOKEN_JSON));
        const resp = await createUserWithApi("INVALID_TOKEN", idToken);
        expect(resp.error).toBe(INVALID_TOKEN_JSON.error);
        expect(resp.user).toStrictEqual(decodedSample);
        expect(assertAPICall("INVALID_TOKEN")).toBe(true);

    });

    test('should create users', async () => {
        fetchMock.mockResponseOnce(JSON.stringify(user));
        const resp = await createUserWithApi("ACCESS_TOKEN", idToken);
        expect(resp.error).toEqual("");
        expect(resp.user).toStrictEqual(decodedSample);
        expect(assertAPICall()).toBe(true);

    });

    test('with null response', async () => {
        fetchMock.mockResponseOnce(null);
        const resp = await createUserWithApi("ACCESS_TOKEN", idToken);
        expect(resp.error).toBeTruthy();
        expect(resp.user).toStrictEqual(decodedSample);
        expect(assertAPICall()).toBe(true);
    });
});
