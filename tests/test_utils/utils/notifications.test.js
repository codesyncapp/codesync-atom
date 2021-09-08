import fs from "fs";
import yaml from "js-yaml";
import untildify from "untildify";
import {NOTIFICATION} from "../../../lib/constants";
import {buildAtomEnv, randomBaseRepoPath, randomRepoPath, TEST_EMAIL} from "../../helpers/helpers";
import {askPublicPrivate, askToUpdateSyncIgnore, showChooseAccount} from "../../../lib/utils/notifications";


describe("showChooseAccount",  () => {
    const baseRepoPath = randomBaseRepoPath();
    const repoPath = randomRepoPath();
    const userFilePath = `${baseRepoPath}/user.yml`;
    const userData = {};
    userData[TEST_EMAIL] = {access_token: "ABC"};

    beforeEach(() => {
        jest.clearAllMocks();
        buildAtomEnv();
        untildify.mockReturnValue(baseRepoPath);
        fs.mkdirSync(baseRepoPath, {recursive: true});
        fs.mkdirSync(repoPath, {recursive: true});
        fs.writeFileSync(userFilePath, yaml.safeDump(userData));
    });

    afterEach(() => {
        fs.rmdirSync(repoPath, {recursive: true});
        fs.rmdirSync(baseRepoPath, {recursive: true});
    });

    test("with no user",  () => {
        fs.writeFileSync(userFilePath, yaml.safeDump({}));
        showChooseAccount(repoPath);
        expect(global.atom.notifications.addError).toHaveBeenCalledTimes(1);
        expect(global.atom.notifications.addError.mock.calls[0][0]).toStrictEqual(NOTIFICATION.NO_VALID_ACCOUNT);
    });

    test("with valid user",  () => {
        showChooseAccount(repoPath);
        expect(global.atom.notifications.addInfo).toHaveBeenCalledTimes(1);
        expect(global.atom.notifications.addInfo.mock.calls[0][0]).toStrictEqual(NOTIFICATION.CHOOSE_ACCOUNT);
    });

});

describe("askPublicPrivate",  () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("askPublicPrivate",  async () => {
        await askPublicPrivate();
        expect(global.atom.notifications.addInfo).toHaveBeenCalledTimes(1);
        expect(global.atom.notifications.addInfo.mock.calls[0][0]).toStrictEqual(NOTIFICATION.PUBLIC_OR_PRIVATE);
    });
});
