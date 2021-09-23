import fs from "fs";
import path from "path";
import untildify from "untildify";
import dateFormat from "dateformat";
import {DATETIME_FORMAT, DEFAULT_BRANCH} from "../../../../lib/constants";
import {mkDir, randomBaseRepoPath, randomRepoPath, rmDir} from "../../../helpers/helpers";
import {manageDiff} from "../../../../lib/events/diff_utils";
import {readYML} from "../../../../lib/utils/common";
import {DIFF_SOURCE} from "../../../../lib/constants";
import {formatPath} from "../../../../lib/utils/path_utils";


describe("manageDiff", () => {

    const repoPath = randomRepoPath();
    const baseRepoPath = randomBaseRepoPath();
    const diffsRepo = path.join(baseRepoPath, ".diffs", ".atom");
    const newFilePath = path.join(repoPath, "new.js");

    beforeEach(() => {
        // Create directories
        mkDir(repoPath);
        mkDir(diffsRepo);
        jest.clearAllMocks();
        untildify.mockReturnValue(baseRepoPath);
    });

    afterEach(() => {
        rmDir(repoPath);
        rmDir(baseRepoPath);
    });

    test("should be skipped",() => {
        manageDiff(repoPath, DEFAULT_BRANCH, newFilePath, "", false, false,
            false, "");
        // Verify no diff file should be generated
        const diffFiles = fs.readdirSync(formatPath(diffsRepo));
        expect(diffFiles).toHaveLength(0);
    });

    test("with createdAt",() => {
        const createdAt = dateFormat(new Date(), DATETIME_FORMAT);
        manageDiff(repoPath, DEFAULT_BRANCH, newFilePath, "diff", false,
            false, false, createdAt);
        // Verify no diff file should be generated
        const diffFiles = fs.readdirSync(formatPath(diffsRepo));
        expect(diffFiles).toHaveLength(1);
        const diffFilePath = path.join(diffsRepo, diffFiles[0]);
        const diffData = readYML(diffFilePath);
        expect(diffData.source).toEqual(DIFF_SOURCE);
        expect(diffData.created_at).toEqual(createdAt);
    });
});
