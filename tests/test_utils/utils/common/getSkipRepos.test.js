'use bable';

import fs from "fs";
import path from "path";
import { getSkipRepos, getSyncIgnoreItems } from "../../../../lib/utils/common";
import { DUMMY_FILE_CONTENT, getSyncIgnoreFilePath, randomRepoPath} from "../../../helpers/helpers";
import { IGNORABLE_DIRECTORIES } from "../../../../lib/constants";

const repoPath = randomRepoPath();
const syncIgnorePath = getSyncIgnoreFilePath(repoPath);
const syncIgnoreData = ".skip_repo_1\n\n\n.skip_repo_2\n";

describe("getSkipRepos", function() {
    beforeEach(() => {
        // Create directories
        fs.mkdirSync(repoPath, { recursive: true });
        fs.mkdirSync(path.join(repoPath, ".skip_repo_1"), { recursive: true });
        fs.mkdirSync(path.join(repoPath, ".skip_repo_2"), { recursive: true });
        fs.writeFileSync(path.join(repoPath, "file.js"), DUMMY_FILE_CONTENT);
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
