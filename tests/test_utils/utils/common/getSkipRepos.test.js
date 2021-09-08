'use bable';

import fs from "fs";
import {describe, expect, test} from '@jest/globals'
import { getSkipRepos, getSyncIgnoreItems } from "../../../../lib/utils/common";
import { randomRepoPath } from "../../../helpers/helpers";
import { IGNORABLE_DIRECTORIES } from "../../../../lib/constants";

const repoPath = randomRepoPath();
const syncIgnorePath = `${repoPath}/.syncignore`;
const syncIgnoreData = ".skip_repo_1\n\n\n.skip_repo_2\n";

describe("getSkipRepos", function() {
    beforeEach(() => {
        if (fs.existsSync(repoPath)) {
            fs.rmdirSync(repoPath);
        }
        // Create directories
        fs.mkdirSync(repoPath, { recursive: true });
        fs.mkdirSync(`${repoPath}/.skip_repo_1`, { recursive: true });
        fs.mkdirSync(`${repoPath}/.skip_repo_2`, { recursive: true });
        fs.writeFileSync(`${repoPath}/file.js`, "");
    });

    afterEach(() => {
        fs.rmdirSync(repoPath, { recursive: true });
    });

    test('with .syncignore items', () => {
        fs.writeFileSync(syncIgnorePath, syncIgnoreData);
        const syncIgnoreItems = getSyncIgnoreItems(repoPath);
        expect(getSkipRepos(repoPath, syncIgnoreItems)).toEqual([...IGNORABLE_DIRECTORIES, ...syncIgnoreItems]);
        fs.rmSync(syncIgnorePath);
    });

    test('with NO .syncignore, default values', () => {
        expect(getSkipRepos(repoPath, [])).toStrictEqual(IGNORABLE_DIRECTORIES);
    });

    test('with non-existing .syncignore item', () => {
        expect(getSkipRepos(repoPath, ["directory"])).toStrictEqual(IGNORABLE_DIRECTORIES);
    });

    test('with file in syncignore', () => {
        expect(getSkipRepos(repoPath, ["file.js"])).toStrictEqual(IGNORABLE_DIRECTORIES);
    });
})
