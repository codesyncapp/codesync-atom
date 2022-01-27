import fs from "fs";
import path from "path";

import {shouldIgnorePath} from "../../../lib/events/utils";
import {getSyncIgnoreFilePath, randomBaseRepoPath, randomRepoPath} from "../../helpers/helpers";
import {IGNORABLE_DIRECTORIES} from "../../../lib/constants";

const baseRepoPath = randomBaseRepoPath();

const normalFilePath = path.join("abc", "12345.js");
const ignorableFilePath = "ignore.js";

const repoPath = randomRepoPath();
const syncIgnorePath = getSyncIgnoreFilePath(repoPath);
const syncIgnoreData = ".git\n\n\n.skip_repo_1\nignore.js";

beforeAll(() => {
    // Create directories
    fs.mkdirSync(repoPath, { recursive: true });
    // Create directories
    fs.mkdirSync(baseRepoPath, { recursive: true });
});

afterAll(() => {
    fs.rmSync(baseRepoPath, { recursive: true });
    fs.rmSync(repoPath, { recursive: true });
});

test("Standard ignorable directories",  () => {
    IGNORABLE_DIRECTORIES.forEach((item) => {
        expect(shouldIgnorePath(repoPath, item)).toBe(true);
    });
});

test("shouldIgnorePath with normal file and no .syncignore",  () => {
    expect(shouldIgnorePath(repoPath, normalFilePath)).toBe(false);
});

test("shouldIgnorePath with normal file and with .syncignore",  () => {
    fs.writeFileSync(syncIgnorePath, syncIgnoreData);
    expect(shouldIgnorePath(repoPath, normalFilePath)).toBe(false);
    fs.rmSync(syncIgnorePath);
});

test("shouldIgnorePath with ignorable file",  () => {
    fs.writeFileSync(syncIgnorePath, syncIgnoreData);
    expect(shouldIgnorePath(repoPath, ignorableFilePath)).toBe(true);
    fs.rmSync(syncIgnorePath);
});

