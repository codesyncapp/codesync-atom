import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import fetchMock from "jest-fetch-mock";

import untildify from "untildify";
import { isBinaryFileSync } from 'isbinaryfile';

import {
    cleanUpDeleteDiff,
    getDIffForDeletedFile,
    handleNewFileUpload,
    isValidDiff,
    similarity
} from "../../lib/codesyncd/utils";
import {
    DIFF_DATA,
    DUMMY_FILE_CONTENT,
    getConfigFilePath,
    getSeqTokenFilePath,
    getUserFilePath,
    INVALID_TOKEN_JSON,
    mkDir,
    PRE_SIGNED_URL,
    randomBaseRepoPath,
    randomRepoPath,
    rmDir,
    writeFile
} from "../helpers/helpers";
import {DEFAULT_BRANCH} from "../../lib/constants";
import {readYML} from "../../lib/utils/common";
import {pathUtils} from "../../lib/utils/path_utils";


describe("isValidDiff",  () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("Missing required keys",  () => {
        const isValid = isValidDiff({});
        expect(isValid).toBe(false);
    });

    test("Rename with null-diff",  () => {
        const diffData = Object.assign({}, DIFF_DATA);
        diffData.is_rename = true;
        const isValid = isValidDiff(diffData);
        expect(isValid).toBe(false);
    });

    test("Rename with non JSON-diff",  () => {
        const diffData = Object.assign({}, DIFF_DATA);
        diffData.is_rename = true;
        diffData.diff = "abc";
        const isValid = isValidDiff(diffData);
        expect(isValid).toBe(false);
    });

    test("Rename with missing diff-keys",  () => {
        const diffData = Object.assign({}, DIFF_DATA);
        diffData.is_rename = true;
        diffData.diff = {};
        const isValid = isValidDiff(diffData);
        expect(isValid).toBe(false);
    });

    test("Rename with is_rename & is_dir_rename",  () => {
        const diffData = Object.assign({}, DIFF_DATA);
        diffData.is_rename = true;
        diffData.is_dir_rename = true;
        diffData.diff = {};
        const isValid = isValidDiff(diffData);
        expect(isValid).toBe(false);
    });

    test("Rename with is_dir_rename and missing keys",  () => {
        const diffData = Object.assign({}, DIFF_DATA);
        diffData.is_dir_rename = true;
        diffData.diff = {};
        const isValid = isValidDiff(diffData);
        expect(isValid).toBe(false);
    });

    test("Valid diff",  () => {
        const diffData = Object.assign({}, DIFF_DATA);
        diffData.diff = "THIS IS DIFF";
        const isValid = isValidDiff(diffData);
        expect(isValid).toBe(true);
    });
});


describe("similarity",  () => {

    test("Empty strings",  () => {
        const match = similarity("", "");
        expect(match).toBe(1.0);
    });

    test("100%  Match",  () => {
        const match = similarity('abc', 'abc');
        expect(match).toBe(1);
    });

    test("No Match",  () => {
        const match = similarity('abc', 'def');
        expect(match).toBe(0);
    });

    test("Partial Match",  () => {
        const match = similarity('abc', 'abdef');
        expect(match).toBeTruthy();
    });

});


describe("handleNewFileUpload",  () => {
    const repoPath = randomRepoPath();
    const fileRelPath = "file.js";
    const filePath = path.join(repoPath, "file.js");

    const configData = {repos: {}};
    configData.repos[repoPath] = {branches: {}};
    configData.repos[repoPath].branches[DEFAULT_BRANCH] = {};

    const baseRepoPath = randomBaseRepoPath();
    const configPath = getConfigFilePath(baseRepoPath);
    const userFilePath = getUserFilePath(baseRepoPath);
    const sequenceTokenFilePath = getSeqTokenFilePath(baseRepoPath);
    untildify.mockReturnValue(baseRepoPath);
    const pathUtilsObj = new pathUtils(repoPath, DEFAULT_BRANCH);
    const originalsRepoBranchPath = pathUtilsObj.getOriginalsRepoBranchPath();

    beforeEach(() => {
        fetch.resetMocks();
        jest.clearAllMocks();
        untildify.mockReturnValue(baseRepoPath);
        mkDir(baseRepoPath);
        writeFile(configPath, yaml.safeDump(configData));
        writeFile(userFilePath, yaml.safeDump({}));
        writeFile(sequenceTokenFilePath, yaml.safeDump({}));
        mkDir(repoPath);
    });

    afterEach(() => {
        rmDir(repoPath);
        rmDir(baseRepoPath);
    });

    test("File not in .originals",  async () => {
        const result = await handleNewFileUpload("TOKEN", repoPath, DEFAULT_BRANCH, "",
            fileRelPath, 1234, configData);
        expect(result.uploaded).toBe(false);
        expect(result.config).toStrictEqual(configData);
    });

    test("Invalid Token",  async () => {
        fs.mkdirSync(originalsRepoBranchPath, {recursive: true});
        writeFile(path.join(originalsRepoBranchPath, fileRelPath), DUMMY_FILE_CONTENT);
        fetchMock.mockResponseOnce(JSON.stringify(INVALID_TOKEN_JSON));
        const result = await handleNewFileUpload("TOKEN", repoPath, DEFAULT_BRANCH, "",
            fileRelPath, 1234, configData);
        expect(result.uploaded).toBe(false);
        expect(result.config).toStrictEqual(configData);
    });

    test("Should Upload",  async () => {
        const response = {id: 1234, url: PRE_SIGNED_URL};
        fetchMock.mockResponseOnce(JSON.stringify(response));
        fs.mkdirSync(originalsRepoBranchPath, {recursive: true});
        const originalsFilePath = path.join(originalsRepoBranchPath, fileRelPath);
        writeFile(path.join(originalsFilePath), DUMMY_FILE_CONTENT);
        writeFile(filePath, DUMMY_FILE_CONTENT);
        const diffData = Object.assign({}, DIFF_DATA);
        diffData.repo_path = repoPath;
        diffData.branch = DEFAULT_BRANCH;
        const result = await handleNewFileUpload("TOKEN", repoPath, DEFAULT_BRANCH, "",
            fileRelPath, 1234, configData);
        expect(result.uploaded).toBe(true);
        expect(fileRelPath in result.config.repos[repoPath].branches[DEFAULT_BRANCH]).toBe(true);
        // File should be deleted from .originals
        expect(fs.existsSync(originalsFilePath)).toBe(false);
    });
});

describe("cleanUpDeleteDiff",  () => {
    const repoPath = randomRepoPath();
    const baseRepoPath = randomBaseRepoPath();
    untildify.mockReturnValue(baseRepoPath);

    const pathUtilsObj = new pathUtils(repoPath, DEFAULT_BRANCH);
    const shadowBranchPath = pathUtilsObj.getShadowRepoBranchPath();
    const originalsBranchPath = pathUtilsObj.getOriginalsRepoBranchPath();
    const cacheBranchPath = pathUtilsObj.getDeletedRepoBranchPath();

    const fileRelPath = "file.js";
    const shadowFilePath = path.join(shadowBranchPath, fileRelPath);
    const originalsFilePath = path.join(originalsBranchPath, fileRelPath);
    const cacheFilePath = path.join(cacheBranchPath, fileRelPath);

    const configPath = getConfigFilePath(baseRepoPath);
    const configData = {repos: {}};
    configData.repos[repoPath] = {branches: {}};
    configData.repos[repoPath].branches[DEFAULT_BRANCH] = {};
    configData.repos[repoPath].branches[DEFAULT_BRANCH][fileRelPath] = 12345;

    beforeEach(() => {
        jest.clearAllMocks();
        untildify.mockReturnValue(baseRepoPath);
        mkDir(baseRepoPath);
        mkDir(shadowBranchPath);
        mkDir(originalsBranchPath);
        mkDir(cacheBranchPath);
        writeFile(shadowFilePath, DUMMY_FILE_CONTENT);
        writeFile(originalsFilePath, DUMMY_FILE_CONTENT);
        writeFile(cacheFilePath, DUMMY_FILE_CONTENT);
        writeFile(configPath, yaml.safeDump(configData));
    });

    afterEach(() => {
        rmDir(repoPath);
        rmDir(baseRepoPath);
    });

    test("Should cleanup file from system directories",  () => {
        expect(fs.existsSync(shadowFilePath)).toBe(true);
        expect(fs.existsSync(originalsFilePath)).toBe(true);
        expect(fs.existsSync(cacheFilePath)).toBe(true);
        cleanUpDeleteDiff(repoPath, DEFAULT_BRANCH, fileRelPath, configData);
        expect(fs.existsSync(shadowFilePath)).toBe(false);
        expect(fs.existsSync(originalsFilePath)).toBe(false);
        expect(fs.existsSync(cacheFilePath)).toBe(false);
        const config = readYML(configPath);
        expect(fileRelPath in config.repos[repoPath].branches[DEFAULT_BRANCH]).toBe(false);
    });

});


describe("getDIffForDeletedFile",  () => {
    const repoPath = randomRepoPath();
    const baseRepoPath = randomBaseRepoPath();
    untildify.mockReturnValue(baseRepoPath);

    const pathUtilsObj = new pathUtils(repoPath, DEFAULT_BRANCH);
    const shadowBranchPath = pathUtilsObj.getShadowRepoBranchPath();
    const originalsBranchPath = pathUtilsObj.getOriginalsRepoBranchPath();
    const cacheBranchPath = pathUtilsObj.getDeletedRepoBranchPath();

    const fileRelPath = "file.js";
    const shadowFilePath = path.join(shadowBranchPath, fileRelPath);
    const originalsFilePath = path.join(originalsBranchPath, fileRelPath);
    const cacheFilePath = path.join(cacheBranchPath, fileRelPath);

    const configPath = getConfigFilePath(baseRepoPath);
    const configData = {repos: {}};
    configData.repos[repoPath] = {branches: {}};
    configData.repos[repoPath].branches[DEFAULT_BRANCH] = {};
    configData.repos[repoPath].branches[DEFAULT_BRANCH][fileRelPath] = 12345;

    beforeEach(() => {
        jest.clearAllMocks();
        untildify.mockReturnValue(baseRepoPath);
        mkDir(baseRepoPath);
        mkDir(shadowBranchPath);
        mkDir(originalsBranchPath);
        mkDir(cacheBranchPath);
        writeFile(shadowFilePath, DUMMY_FILE_CONTENT);
        writeFile(originalsFilePath, DUMMY_FILE_CONTENT);
        writeFile(cacheFilePath, DUMMY_FILE_CONTENT);
        writeFile(configPath, yaml.safeDump(configData));
    });

    afterEach(() => {
        rmDir(repoPath);
        rmDir(baseRepoPath);
    });

    test("No shadow file",  () => {
        fs.rmSync(shadowFilePath);
        const diff = getDIffForDeletedFile(repoPath, DEFAULT_BRANCH, fileRelPath, configData);
        expect(diff).toStrictEqual("");
        expect(fs.existsSync(shadowFilePath)).toBe(false);
        expect(fs.existsSync(originalsFilePath)).toBe(false);
        expect(fs.existsSync(cacheFilePath)).toBe(false);
    });

    test("with Binary File",  () => {
        isBinaryFileSync.mockReturnValue(true);
        const diff = getDIffForDeletedFile(repoPath, DEFAULT_BRANCH, fileRelPath, configData);
        expect(diff).toStrictEqual("");
        expect(fs.existsSync(shadowFilePath)).toBe(false);
        expect(fs.existsSync(originalsFilePath)).toBe(false);
        expect(fs.existsSync(cacheFilePath)).toBe(false);
    });

    test("Should get non-empty diff",  () => {
        isBinaryFileSync.mockReturnValue(false);
        const diff = getDIffForDeletedFile(repoPath, DEFAULT_BRANCH, fileRelPath, configData);
        expect(diff).toBeTruthy();
        expect(fs.existsSync(shadowFilePath)).toBe(false);
        expect(fs.existsSync(originalsFilePath)).toBe(false);
        expect(fs.existsSync(cacheFilePath)).toBe(false);

    });

});
