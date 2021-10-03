import fs from "fs";
import path from "path";
import untildify from "untildify";
import getBranchName from "current-git-branch";
import {diff_match_patch} from "diff-match-patch";

import {DEFAULT_BRANCH, DIFF_SOURCE} from "../../../../lib/constants";
import {
    buildAtomEnv,
    DUMMY_FILE_CONTENT,
    getConfigFilePath,
    getSyncIgnoreFilePath,
    randomBaseRepoPath,
    randomRepoPath
} from "../../../helpers/helpers";
import {pathUtils} from "../../../../lib/utils/path_utils";
import {eventHandler} from "../../../../lib/events/event_handler";
import yaml from "js-yaml";
import {readYML} from "../../../../lib/utils/common";


describe("handleChangeEvent",  () => {
    /*
     {
        source: 'vs-code',
        created_at: '2021-08-26 18:59:51.954',
        diff: "",
        repo_path: 'tests/tests_data/test_repo_sNIVUqukDv',
        branch: 'default',
        file_relative_path: 'new.js',
        is_new_file: true
      }
    */
    const repoPath = randomRepoPath();
    const baseRepoPath = randomBaseRepoPath();
    const configPath = getConfigFilePath(baseRepoPath);
    untildify.mockReturnValue(baseRepoPath);

    const pathUtilsObj = new pathUtils(repoPath, DEFAULT_BRANCH);
    const diffsRepo = pathUtilsObj.getDiffsRepo();
    const shadowRepoBranchPath = pathUtilsObj.getShadowRepoBranchPath();
    const originalsRepoBranchPath = pathUtilsObj.getOriginalsRepoBranchPath();

    const fileRelPath = "file.js";
    const filePath = path.join(repoPath, fileRelPath);
    const syncIgnorePath = getSyncIgnoreFilePath(repoPath);
    const shadowFilePath = path.join(shadowRepoBranchPath, fileRelPath);
    const syncIgnoreData = ".git\n\n\n.skip_repo_1\nignore.js";
    const ignorableFilePath = path.join(repoPath, "ignore.js");

    beforeEach(() => {
        jest.clearAllMocks();
        buildAtomEnv();
        untildify.mockReturnValue(baseRepoPath);
        atom.project.getPaths.mockReturnValue([repoPath]);
        getBranchName.mockReturnValue(DEFAULT_BRANCH);
        // Create directories
        fs.mkdirSync(repoPath, { recursive: true });
        fs.mkdirSync(diffsRepo, { recursive: true });
        fs.mkdirSync(originalsRepoBranchPath, { recursive: true });
        fs.mkdirSync(shadowRepoBranchPath, { recursive: true });
        fs.writeFileSync(filePath, DUMMY_FILE_CONTENT);
        fs.writeFileSync(ignorableFilePath, "use babel;");
        fs.writeFileSync(syncIgnorePath, syncIgnoreData);
    });

    afterEach(() => {
        fs.rmSync(repoPath, { recursive: true, force: true });
        fs.rmSync(baseRepoPath, { recursive: true, force: true });
    });

    test("Repo not synced", () => {
        const handler = new eventHandler();
        const event = {};
        handler.handleChangeEvent(event);
        // Verify correct diff file has been generated
        let diffFiles = fs.readdirSync(diffsRepo);
        expect(diffFiles).toHaveLength(0);
        expect(fs.existsSync(shadowFilePath)).toBe(false);
    });

    test("Synced repo, Ignorable file", () => {
        const config = {'repos': {}};
        config.repos[repoPath] = {'branches': {}};
        fs.writeFileSync(configPath, yaml.safeDump(config));
        const handler = new eventHandler();
        const editor = {
            getPath: function () {
                return path.join(repoPath, ".idea");
            },
            getText: function () {
                return DUMMY_FILE_CONTENT;
            }
        };
        handler.handleChangeEvent(editor);
        let diffFiles = fs.readdirSync(diffsRepo);
        expect(diffFiles).toHaveLength(0);
        expect(fs.existsSync(shadowFilePath)).toBe(false);
    });

    test("Synced repo, shadow file does not exist", () => {
        const config = {'repos': {}};
        config.repos[repoPath] = {'branches': {}};
        fs.writeFileSync(configPath, yaml.safeDump(config));
        const handler = new eventHandler();
        const editor = {
            getPath: function () {
                return filePath;
            },
            getText: function () {
                return DUMMY_FILE_CONTENT;
            }
        };
        handler.handleChangeEvent(editor);
        expect(fs.existsSync(shadowFilePath)).toBe(true);
        let diffFiles = fs.readdirSync(diffsRepo);
        expect(diffFiles).toHaveLength(0);
    });

    test("Synced repo, file in .syncignore", () => {
        const config = {'repos': {}};
        config.repos[repoPath] = {'branches': {}};
        fs.writeFileSync(configPath, yaml.safeDump(config));
        const handler = new eventHandler();
        const editor = {
            getPath: function () {
                return path.join(repoPath, ".idea");
            },
            getText: function () {
                return DUMMY_FILE_CONTENT;
            }
        };
        handler.handleChangeEvent(editor);
        expect(fs.existsSync(shadowFilePath)).toBe(false);
        let diffFiles = fs.readdirSync(diffsRepo);
        expect(diffFiles).toHaveLength(0);
    });

    test("Synced repo, Shadow has same content", () => {
        fs.writeFileSync(shadowFilePath, DUMMY_FILE_CONTENT);
        const config = {'repos': {}};
        config.repos[repoPath] = {'branches': {}};
        fs.writeFileSync(configPath, yaml.safeDump(config));
        const handler = new eventHandler();
        const editor = {
            getPath: function () {
                return filePath;
            },
            getText: function () {
                return DUMMY_FILE_CONTENT;
            }
        };
        handler.handleChangeEvent(editor);
        let diffFiles = fs.readdirSync(diffsRepo);
        expect(diffFiles).toHaveLength(0);
    });

    test("Synced repo, Should add diff and update shadow file", () => {
        fs.writeFileSync(shadowFilePath, DUMMY_FILE_CONTENT);
        const updatedText = `${DUMMY_FILE_CONTENT} Changed data`;
        const config = {'repos': {}};
        config.repos[repoPath] = {'branches': {}};
        fs.writeFileSync(configPath, yaml.safeDump(config));
        const handler = new eventHandler();
        const editor = {
            getPath: function () {
                return filePath;
            },
            getText: function () {
                return updatedText;
            }
        };
        handler.handleChangeEvent(editor);
        // Read shadow file
        const shadowText = fs.readFileSync(shadowFilePath, "utf8");
        expect(shadowText).toStrictEqual(updatedText);
        const diffFiles = fs.readdirSync(diffsRepo);
        expect(diffFiles).toHaveLength(1);
        const diffFilePath = path.join(diffsRepo, diffFiles[0]);
        const diffData = readYML(diffFilePath);
        expect(diffData.source).toEqual(DIFF_SOURCE);
        expect(diffData.is_new_file).toBeFalsy();
        expect(diffData.is_rename).toBeFalsy();
        expect(diffData.is_deleted).toBeFalsy();
        expect(diffData.repo_path).toEqual(repoPath);
        expect(diffData.branch).toEqual(DEFAULT_BRANCH);
        expect(diffData.file_relative_path).toEqual(fileRelPath);

        // Verify diff is correct
        const dmp = new diff_match_patch();
        const patches = dmp.patch_make(DUMMY_FILE_CONTENT, updatedText);
        //  Create text representation of patches objects
        const diffs = dmp.patch_toText(patches);
        expect(diffData.diff).toStrictEqual(diffs);
    });
});
