import fs from "fs";
import { getSyncIgnoreItems } from "../../../lib/utils/common";
import {getSyncIgnoreFilePath, randomRepoPath, SYNC_IGNORE_DATA} from "../../helpers/helpers";

const repoPath = randomRepoPath();
const syncIgnorePath = getSyncIgnoreFilePath(repoPath);

beforeAll(() => {
    // Create directories
    fs.mkdirSync(repoPath, { recursive: true });
});

afterAll(() => {
    fs.rmdirSync(repoPath, { recursive: true });
});

test('syncIgnore items with .syncignore', () => {
    fs.writeFileSync(syncIgnorePath, SYNC_IGNORE_DATA);
    expect(getSyncIgnoreItems(repoPath)).toStrictEqual([".DS_Store", ".git", ".node_modules"]);
    fs.rmSync(syncIgnorePath);
});

test('syncIgnore items with NO .syncignore', () => {
    expect(getSyncIgnoreItems(repoPath)).toStrictEqual([]);
});
