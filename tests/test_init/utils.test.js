import fs from "fs";
import os from "os";
import path from "path";
import yaml from "js-yaml";
import untildify from 'untildify';
import getBranchName from 'current-git-branch';
import {initUtils} from "../../lib/init/utils";

import {
    ANOTHER_TEST_EMAIL,
    DUMMY_FILE_CONTENT,
    SYNC_IGNORE_DATA,
    TEST_EMAIL,
    TEST_REPO_RESPONSE,
    TEST_USER,
    USER_PLAN,
    randomBaseRepoPath,
    randomRepoPath,
    buildAtomEnv,
    getConfigFilePath,
    getUserFilePath,
    getSeqTokenFilePath,
    getSyncIgnoreFilePath,
    mkDir,
    writeFile,
    rmDir, addUser
} from "../helpers/helpers";
import {readYML} from "../../lib/utils/common";
import fetchMock from "jest-fetch-mock";
import {isBinaryFileSync} from "isbinaryfile";
import {pathUtils} from "../../lib/utils/path_utils";
import {API_INIT, DEFAULT_BRANCH, DIFF_SOURCE, NOTIFICATION, SYNCIGNORE} from "../../lib/constants";


describe("isValidRepoSize", () => {
    const baseRepoPath = randomBaseRepoPath();

    beforeEach(() => {
        buildAtomEnv();
        jest.clearAllMocks();
        untildify.mockReturnValue(baseRepoPath);
    });

    test("true result", () => {
        const initUtilsObj = new initUtils();
        const isValid = initUtilsObj.isValidRepoSize(USER_PLAN.SIZE - 10, USER_PLAN);
        expect(isValid).toBe(true);
        expect(atom.notifications.addError).toHaveBeenCalledTimes(0);
    });

    test("false result", () => {
        const initUtilsObj = new initUtils();
        const isValid = initUtilsObj.isValidRepoSize(USER_PLAN.SIZE + 10, USER_PLAN);
        expect(isValid).toBe(false);
        expect(atom.notifications.addError).toHaveBeenCalledTimes(1);
        expect(atom.notifications.addError.mock.calls[0][0].startsWith(NOTIFICATION.REPOS_LIMIT_BREACHED)).toBe(true);
        const options = atom.notifications.addError.mock.calls[0][1];
        expect(options).toBeFalsy();
    });
});

describe("isValidFilesCount", () => {
    const baseRepoPath = randomBaseRepoPath();

    beforeEach(() => {
        jest.clearAllMocks();
        untildify.mockReturnValue(baseRepoPath);
    });

    test("true result", () => {
        const initUtilsObj = new initUtils();
        const isValid = initUtilsObj.isValidFilesCount(USER_PLAN.FILE_COUNT - 10, USER_PLAN);
        expect(isValid).toBe(true);
        expect(atom.notifications.addError).toHaveBeenCalledTimes(0);
    });

    test("false result", () => {
        const initUtilsObj = new initUtils();
        const isValid = initUtilsObj.isValidFilesCount(USER_PLAN.FILE_COUNT + 10, USER_PLAN);
        expect(isValid).toBe(false);
        expect(atom.notifications.addError).toHaveBeenCalledTimes(1);
        expect(atom.notifications.addError.mock.calls[0][0].startsWith(NOTIFICATION.FILES_LIMIT_BREACHED)).toBe(true);
        const options = atom.notifications.addError.mock.calls[0][1];
        expect(options).toBeFalsy();
    });
});

describe("successfullySynced", () => {
    const baseRepoPath = randomBaseRepoPath();
    const repoPath = randomRepoPath();
    const configPath = getConfigFilePath(baseRepoPath);
    const configData = {repos: {}};

    beforeEach(() => {
        jest.clearAllMocks();
        untildify.mockReturnValue(baseRepoPath);
        fs.mkdirSync(baseRepoPath);
        fs.mkdirSync(repoPath);
        fs.writeFileSync(configPath, yaml.safeDump(configData));
    });

    afterEach(() => {
        fs.rmSync(repoPath, {recursive: true, force: true});
        fs.rmSync(baseRepoPath, {recursive: true, force: true});
    });

    test("Non Synced Repo", () => {
        const initUtilsObj = new initUtils(repoPath);
        const isSynced = initUtilsObj.successfullySynced();
        expect(isSynced).toBe(false);
    });

    test("Non Synced Branch", () => {
        const initUtilsObj = new initUtils(repoPath);
        configData.repos[repoPath] = {branches: {}};
        fs.writeFileSync(configPath, yaml.safeDump(configData));
        const isSynced = initUtilsObj.successfullySynced();
        expect(isSynced).toBe(true);
    });

    test("Invalid file IDs", () => {
        const initUtilsObj = new initUtils(repoPath);
        configData.repos[repoPath] = {branches: {}};
        configData.repos[repoPath].branches[DEFAULT_BRANCH] = {
            file_1: null,
            file_2: null,
        };
        fs.writeFileSync(configPath, yaml.safeDump(configData));
        getBranchName.mockReturnValueOnce(DEFAULT_BRANCH);
        const isSynced = initUtilsObj.successfullySynced();
        expect(isSynced).toBe(false);
    });

    test("Valid file IDs", () => {
        const initUtilsObj = new initUtils(repoPath);
        configData.repos[repoPath] = {branches: {}};
        configData.repos[repoPath].branches[DEFAULT_BRANCH] = {
            file_1: 123,
            file_2: 456,
        };
        fs.writeFileSync(configPath, yaml.safeDump(configData));
        getBranchName.mockReturnValueOnce(DEFAULT_BRANCH);
        const isSynced = initUtilsObj.successfullySynced();
        expect(isSynced).toBe(true);
    });
});

describe("getSyncablePaths", () => {
    const baseRepoPath = randomBaseRepoPath();
    const repoPath = randomRepoPath();
    const syncIgnorePath = getSyncIgnoreFilePath(repoPath);
    const filePath = path.join(repoPath, "file.js");

    beforeEach(() => {
        jest.clearAllMocks();
        untildify.mockReturnValue(baseRepoPath);
        mkDir(baseRepoPath);
        mkDir(repoPath);
    });

    afterEach(() => {
        fs.rmSync(repoPath, {recursive: true, force: true});
        fs.rmSync(baseRepoPath, {recursive: true, force: true});
    });

    test("No .syncignore", () => {
        fs.writeFileSync(filePath, "");
        const initUtilsObj = new initUtils(repoPath);
        const paths = initUtilsObj.getSyncablePaths(USER_PLAN);
        expect(paths).toHaveLength(1);
    });

    test("Ignore file and match rest", () => {
        isBinaryFileSync.mockReturnValue(false);
        fs.writeFileSync(filePath, "");
        fs.writeFileSync(path.join(repoPath, "ignore.js"), DUMMY_FILE_CONTENT);
        fs.writeFileSync(syncIgnorePath, SYNC_IGNORE_DATA + "\nignore.js");
        const initUtilsObj = new initUtils(repoPath);
        const paths = initUtilsObj.getSyncablePaths(USER_PLAN);
        // 1 is .syncignore, other is file.js
        expect(paths).toHaveLength(2);
        expect(paths[0].rel_path).toStrictEqual(SYNCIGNORE);
        expect(paths[0].is_binary).toBe(false);
        expect(paths[0].file_path).toStrictEqual(syncIgnorePath);
        expect(paths[0].size).toBeTruthy();
        expect(paths[1].rel_path).toStrictEqual("file.js");
        expect(paths[1].is_binary).toBe(false);
        expect(paths[1].file_path).toStrictEqual(filePath);
        expect(paths[1].size).toStrictEqual(0);
    });

    test("Size increases the limit", () => {
        fs.writeFileSync(filePath, "");
        fs.writeFileSync(path.join(repoPath, "ignore.js"), "DUMMY FILE CONTENT");
        fs.writeFileSync(syncIgnorePath, SYNC_IGNORE_DATA + "\nignore.js");
        const userPlan = Object.assign({}, USER_PLAN);
        userPlan.SIZE = 0;
        const initUtilsObj = new initUtils(repoPath);
        const paths = initUtilsObj.getSyncablePaths(userPlan);
        expect(paths).toHaveLength(0);
    });
});

describe("copyFilesTo", () => {
    const baseRepoPath = randomBaseRepoPath();
    const repoPath = randomRepoPath();
    const filePath = path.join(repoPath, "file.js");
    untildify.mockReturnValue(baseRepoPath);

    const pathUtilsObj = new pathUtils(repoPath, DEFAULT_BRANCH);
    const shadowRepo = pathUtilsObj.getShadowRepoPath();
    const deletedRepo = pathUtilsObj.getDeletedRepoPath();

    beforeEach(() => {
        mkDir(repoPath);
        fs.writeFileSync(filePath, DUMMY_FILE_CONTENT);
        mkDir(baseRepoPath);
        jest.clearAllMocks();
        untildify.mockReturnValue(baseRepoPath);
    });

    afterEach(() => {
        fs.rmSync(repoPath, {recursive: true, force: true});
        fs.rmSync(baseRepoPath, {recursive: true, force: true});
    });

    test("Copy to Shadow repo", () => {
        const initUtilsObj = new initUtils(repoPath);
        initUtilsObj.copyFilesTo([filePath], shadowRepo);
        expect(fs.existsSync(path.join(shadowRepo, "file.js"))).toBe(true);
    });

    test("Copy from .shadow to .deleted repo", () => {
        // Copy to shadow
        const initUtilsObj = new initUtils(repoPath);
        initUtilsObj.copyFilesTo([filePath], shadowRepo);
        const shadowFilePath = path.join(shadowRepo, "file.js");
        const deletedFilePath = path.join(deletedRepo, "file.js");
        expect(fs.existsSync(shadowFilePath)).toBe(true);
        // Copy to .originals
        initUtilsObj.copyFilesTo([shadowFilePath], deletedRepo, true);
        expect(fs.existsSync(deletedFilePath)).toBe(true);
    });

    test("Copy non-existing file", () => {
        fs.rmSync(filePath);
        const initUtilsObj = new initUtils(repoPath);
        initUtilsObj.copyFilesTo([filePath], shadowRepo);
        expect(fs.existsSync(path.join(shadowRepo, "file.js"))).toBe(false);
    });
});

describe("saveIamUser", () => {
    const baseRepoPath = randomBaseRepoPath();
    const userFilePath = getUserFilePath(baseRepoPath);
    const userFileData = {};
    userFileData[TEST_USER.email] = {
        access_key: TEST_USER.iam_access_key,
        secret_key: TEST_USER.iam_secret_key,
    };

    beforeEach(() => {
        mkDir(baseRepoPath);
        jest.clearAllMocks();
        untildify.mockReturnValue(baseRepoPath);
    });

    afterEach(() => {
        rmDir(baseRepoPath);
    });

    test("With no user.yml", () => {
        const initUtilsObj = new initUtils();
        initUtilsObj.saveIamUser(TEST_USER);
        expect(fs.existsSync(userFilePath)).toBe(true);
        const users = readYML(userFilePath);
        expect(users[TEST_USER.email].access_key).toStrictEqual(TEST_USER.iam_access_key);
        expect(users[TEST_USER.email].secret_key).toStrictEqual(TEST_USER.iam_secret_key);
    });

    test("With no active user.yml",  () => {
        addUser(baseRepoPath, false);
        const initUtilsObj = new initUtils();
        initUtilsObj.saveIamUser(TEST_USER);
        expect(fs.existsSync(userFilePath)).toBe(true);
        const users = readYML(userFilePath);
        expect(users[TEST_USER.email].access_key).toStrictEqual(TEST_USER.iam_access_key);
        expect(users[TEST_USER.email].secret_key).toStrictEqual(TEST_USER.iam_secret_key);
    });

    test("User not in user.yml", () => {
        fs.writeFileSync(userFilePath, yaml.safeDump(userFileData));
        const testUser = Object.assign({}, TEST_USER);
        testUser.email = ANOTHER_TEST_EMAIL;
        const initUtilsObj = new initUtils();
        initUtilsObj.saveIamUser(testUser);
        expect(fs.existsSync(userFilePath)).toBe(true);
        const users = readYML(userFilePath);
        expect(users[ANOTHER_TEST_EMAIL].access_key).toStrictEqual(TEST_USER.iam_access_key);
        expect(users[ANOTHER_TEST_EMAIL].secret_key).toStrictEqual(TEST_USER.iam_secret_key);
    });

    test("User user in user.yml with only access token", () => {
        userFileData[TEST_USER.email] = {
            access_token: "TOKEN ABC"
        };
        fs.writeFileSync(userFilePath, yaml.safeDump(userFileData));
        const testUser = Object.assign({}, TEST_USER);
        testUser.email = TEST_EMAIL;
        const initUtilsObj = new initUtils();
        initUtilsObj.saveIamUser(testUser);
        expect(fs.existsSync(userFilePath)).toBe(true);
        const users = readYML(userFilePath);
        expect(users[TEST_EMAIL].access_key).toStrictEqual(TEST_USER.iam_access_key);
        expect(users[TEST_EMAIL].secret_key).toStrictEqual(TEST_USER.iam_secret_key);
        expect(users[TEST_EMAIL].access_token).toStrictEqual("TOKEN ABC");
    });

});

describe("saveSequenceTokenFile", () => {
    const baseRepoPath = randomBaseRepoPath();
    const sequenceTokenFilePath = getSeqTokenFilePath(baseRepoPath);
    const sequenceTokenFileData = {};
    sequenceTokenFileData[TEST_EMAIL] = "";

    beforeEach(() => {
        jest.clearAllMocks();
        untildify.mockReturnValue(baseRepoPath);
        mkDir(baseRepoPath);
    });

    afterEach(() => {
        rmDir(baseRepoPath);
    });

    test("With no sequence_token.yml", () => {
        const initUtilsObj = new initUtils();
        initUtilsObj.saveSequenceTokenFile(TEST_EMAIL);
        expect(fs.existsSync(sequenceTokenFilePath)).toBe(true);
        const users = readYML(sequenceTokenFilePath);
        expect(users[TEST_EMAIL]).toStrictEqual("");
    });

    test("User not in user.yml", () => {
        const initUtilsObj = new initUtils();
        fs.writeFileSync(sequenceTokenFilePath, yaml.safeDump(sequenceTokenFileData));
        initUtilsObj.saveSequenceTokenFile(ANOTHER_TEST_EMAIL);
        expect(fs.existsSync(sequenceTokenFilePath)).toBe(true);
        const users = readYML(sequenceTokenFilePath);
        expect(users[ANOTHER_TEST_EMAIL]).toStrictEqual("");
    });
});

describe("saveFileIds", () => {
    const baseRepoPath = randomBaseRepoPath();
    const repoPath = randomRepoPath();
    const configPath = getConfigFilePath(baseRepoPath);
    const configData = {repos: {}};
    configData.repos[repoPath] = {branches: {}};

    beforeEach(() => {
        jest.clearAllMocks();
        untildify.mockReturnValue(baseRepoPath);
        mkDir(baseRepoPath);
        mkDir(repoPath);
        fs.writeFileSync(configPath, yaml.safeDump(configData));
    });

    afterEach(() => {
        fs.rmSync(repoPath, {recursive: true, force: true});
        fs.rmSync(baseRepoPath, {recursive: true, force: true});
    });

    test("Should save file IDs", () => {
        const initUtilsObj = new initUtils(repoPath);
        initUtilsObj.saveFileIds(DEFAULT_BRANCH, "ACCESS_TOKEN", TEST_EMAIL, TEST_REPO_RESPONSE);
        const config = readYML(configPath);
        expect(config.repos[repoPath].branches[DEFAULT_BRANCH]).toStrictEqual(TEST_REPO_RESPONSE.file_path_and_id);
    });
});

describe("uploadRepo", () => {
    const baseRepoPath = randomBaseRepoPath();
    const repoPath = randomRepoPath();
    const syncIgnorePath = getSyncIgnoreFilePath(repoPath);
    const filePath = path.join(repoPath, "file.js");
    const configPath = getConfigFilePath(baseRepoPath);
    const userFilePath = getUserFilePath(baseRepoPath);
    const sequenceTokenFilePath = getSeqTokenFilePath(baseRepoPath);
    const configData = {repos: {}};

    beforeEach(() => {
        fetch.resetMocks();
        jest.clearAllMocks();
        untildify.mockReturnValue(baseRepoPath);
        mkDir(baseRepoPath);
        mkDir(repoPath);
        writeFile(configPath, yaml.safeDump(configData));
        writeFile(syncIgnorePath, SYNC_IGNORE_DATA + "\nignore.js");
        writeFile(filePath, DUMMY_FILE_CONTENT);
        writeFile(path.join(repoPath, "ignore.js"), DUMMY_FILE_CONTENT);
    });

    afterEach(() => {
        fs.rmSync(repoPath, {recursive: true, force: true});
        fs.rmSync(baseRepoPath, {recursive: true, force: true});
    });

    test("Server Down", async () => {
        // Add repo in config
        configData.repos[repoPath] = {branches: {}};
        writeFile(configPath, yaml.safeDump(configData));
        // Generate ItemPaths
        const initUtilsObj = new initUtils(repoPath);
        const itemPaths = initUtilsObj.getSyncablePaths(USER_PLAN);
        // 1 is .syncignore, other is file.js
        expect(itemPaths).toHaveLength(2);
        // Mock response for checkServerDown
        fetchMock.mockResponseOnce(JSON.stringify({status: false}))

        await initUtilsObj.uploadRepo(DEFAULT_BRANCH, "ACCESS_TOKEN", itemPaths, TEST_EMAIL, false);

        // Verify file Ids have been added in config
        const config = readYML(configPath);
        expect(config.repos[repoPath].branches[DEFAULT_BRANCH]).toStrictEqual({
            ".syncignore": null,
            "file.js": null,
        });
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test("repo In Config", async () => {
        // Add repo in config
        configData.repos[repoPath] = {branches: {}};
        writeFile(configPath, yaml.safeDump(configData));
        // Generate ItemPaths
        const initUtilsObj = new initUtils(repoPath);
        const itemPaths = initUtilsObj.getSyncablePaths(USER_PLAN);
        // 1 is .syncignore, other is file.js
        expect(itemPaths).toHaveLength(2);
        // Mock response for checkServerDown
        fetchMock
            .mockResponseOnce(JSON.stringify({status: true}))
            .mockResponseOnce(JSON.stringify(TEST_REPO_RESPONSE));

        await initUtilsObj.uploadRepo(DEFAULT_BRANCH, "ACCESS_TOKEN", itemPaths, TEST_EMAIL, false);

        // Verify file Ids have been added in config
        const config = readYML(configPath);
        expect(config.repos[repoPath].branches[DEFAULT_BRANCH]).toStrictEqual(TEST_REPO_RESPONSE.file_path_and_id);

        // Verify sequence_token.yml
        let users = readYML(sequenceTokenFilePath);
        expect(users[TEST_EMAIL]).toStrictEqual("");

        // verify user.yml
        users = readYML(userFilePath);
        expect(users[TEST_USER.email].access_key).toStrictEqual(TEST_USER.iam_access_key);
        expect(users[TEST_USER.email].secret_key).toStrictEqual(TEST_USER.iam_secret_key);
    });

    test("repo Not In Config", async () => {
        const configData = {repos: {}};
        writeFile(configPath, yaml.safeDump(configData));
        const initUtilsObj = new initUtils(repoPath);
        const itemPaths = initUtilsObj.getSyncablePaths(USER_PLAN);
        // 1 is .syncignore, other is file.js
        expect(itemPaths).toHaveLength(2);
        // Mock response for checkServerDown
        fetchMock
            .mockResponseOnce(JSON.stringify({status: true}))
            .mockResponseOnce(JSON.stringify(TEST_REPO_RESPONSE));

        await initUtilsObj.uploadRepo(DEFAULT_BRANCH, "ACCESS_TOKEN", itemPaths, TEST_EMAIL, false);

        // Verify file Ids have been added in config
        const config = readYML(configPath);
        expect(config.repos[repoPath].branches[DEFAULT_BRANCH]).toStrictEqual(TEST_REPO_RESPONSE.file_path_and_id);

        // Verify sequence_token.yml
        let users = readYML(sequenceTokenFilePath);
        expect(users[TEST_EMAIL]).toStrictEqual("");

        // verify user.yml
        users = readYML(userFilePath);
        expect(users[TEST_USER.email].access_key).toStrictEqual(TEST_USER.iam_access_key);
        expect(users[TEST_USER.email].secret_key).toStrictEqual(TEST_USER.iam_secret_key);

        // Assert API call
        expect(fetch.mock.calls[1][0]).toStrictEqual(API_INIT);
        const options = fetch.mock.calls[1][1];
        expect(options.method).toStrictEqual('POST');
        expect(options.headers).toStrictEqual({
            'Content-Type': 'application/json',
            'Authorization': `Basic ACCESS_TOKEN`
        });
        const body = JSON.parse(fetch.mock.calls[1][1].body);
        expect(body.name).toStrictEqual(path.basename(repoPath));
        expect(body.is_public).toBe(false);
        expect(body.branch).toStrictEqual(DEFAULT_BRANCH);
        expect(body.source).toStrictEqual(DIFF_SOURCE);
        expect(body.platform).toStrictEqual(os.platform());
        const files_data = JSON.parse(body.files_data);
        [".syncignore", "file.js"].forEach(key => {
            expect(files_data[key]).toBeTruthy();
        });
    });

    test("Error in uploadRepoToServer", async () => {
        // Write these files as putLogEvent is called when error occurs
        writeFile(userFilePath, yaml.safeDump({}));
        writeFile(sequenceTokenFilePath, yaml.safeDump({}));

        const initUtilsObj = new initUtils(repoPath);
        const itemPaths = initUtilsObj.getSyncablePaths(USER_PLAN);
        // 1 is .syncignore, other is file.js
        expect(itemPaths).toHaveLength(2);
        // Mock response for checkServerDown
        fetchMock
            .mockResponseOnce(JSON.stringify({status: true}))
            .mockResponseOnce(null);

        await initUtilsObj.uploadRepo(DEFAULT_BRANCH, "ACCESS_TOKEN", itemPaths, TEST_EMAIL, false);

        // Verify file Ids have been added in config
        const config = readYML(configPath);
        expect(DEFAULT_BRANCH in config.repos[repoPath].branches[DEFAULT_BRANCH]).toBe(false);

        // Verify sequence_token.yml
        const sequenceTokenUsers = readYML(sequenceTokenFilePath);
        expect(TEST_EMAIL in sequenceTokenUsers).toBe(false);
        // verify user.yml
        const users = readYML(userFilePath);
        expect(TEST_EMAIL in users).toBe(false);
        // Verify error msg
        expect(atom.notifications.addError).toHaveBeenCalledTimes(1);
        expect(atom.notifications.addError.mock.calls[0][0]).toStrictEqual(NOTIFICATION.SYNC_FAILED);
        const options = atom.notifications.addError.mock.calls[0][1];
        expect(options).toBeFalsy();
    });
});
