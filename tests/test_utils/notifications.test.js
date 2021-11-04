import fs from "fs";
import yaml from "js-yaml";
import untildify from "untildify";

import { initHandler } from "../../lib/init/init_handler";
import { showChooseAccount } from "../../lib/utils/notifications";
import { getPublicPrivateMsg, NOTIFICATION } from "../../lib/constants";
import {
    addUser,
    buildAtomEnv, getConfigFilePath,
    getUserFilePath,
    randomBaseRepoPath,
    randomRepoPath,
    TEST_EMAIL
} from "../helpers/helpers";


describe("showChooseAccount",  () => {
    const baseRepoPath = randomBaseRepoPath();
    const repoPath = randomRepoPath();
    const configPath = getConfigFilePath(baseRepoPath);

    beforeEach(() => {
        fetch.resetMocks();
        jest.clearAllMocks();
        buildAtomEnv();
        untildify.mockReturnValue(baseRepoPath);
        fs.mkdirSync(baseRepoPath, {recursive: true});
        fs.mkdirSync(repoPath, {recursive: true});
        fs.writeFileSync(configPath, yaml.safeDump({repos: {}}));
    });

    afterEach(() => {
        fs.rmSync(repoPath, { recursive: true, force: true });
        fs.rmSync(baseRepoPath, { recursive: true, force: true });
    });

    test("with no user",  async () => {
        await showChooseAccount(repoPath);
        expect(atom.notifications.addError).toHaveBeenCalledTimes(1);
        expect(atom.notifications.addError.mock.calls[0][0]).toStrictEqual(NOTIFICATION.NO_VALID_ACCOUNT);
        const options = atom.notifications.addError.mock.calls[0][1];
        expect(options).toBeFalsy();
    });

    test("with no active user",  async () => {
        addUser(baseRepoPath, false);
        await showChooseAccount(repoPath);
        expect(atom.notifications.addError).toHaveBeenCalledTimes(1);
        expect(atom.notifications.addError.mock.calls[0][0]).toStrictEqual(NOTIFICATION.NO_VALID_ACCOUNT);
        const options = atom.notifications.addError.mock.calls[0][1];
        expect(options).toBeFalsy();
    });

    test("with valid user",  async () => {
        addUser(baseRepoPath);
        const user = {
            "email": TEST_EMAIL,
            "plan": {
                REPO_COUNT: 5
            },
            "repo_count": 4
        };
        fetchMock
            .mockResponseOnce(JSON.stringify({ status: true }))
            .mockResponseOnce(JSON.stringify(user));
        const handler = await showChooseAccount(repoPath);
        expect(atom.notifications.addError).toHaveBeenCalledTimes(0);
        expect(handler.accessToken).toStrictEqual("ACCESS_TOKEN");
        expect(atom.notifications.addInfo).toHaveBeenCalledTimes(1);
        const msg = getPublicPrivateMsg(repoPath);
        expect(atom.notifications.addInfo.mock.calls[0][0]).toStrictEqual(msg);
        const options = atom.notifications.addInfo.mock.calls[0][1];
        expect(options.buttons).toHaveLength(2);
        expect(options.buttons[0].text).toStrictEqual(NOTIFICATION.PUBLIC);
        expect(options.buttons[1].text).toStrictEqual(NOTIFICATION.PRIVATE);

        // TODO: In case we activate choose account option
        // expect(atom.notifications.addInfo).toHaveBeenCalledTimes(1);
        // expect(atom.notifications.addInfo.mock.calls[0][0]).toStrictEqual(NOTIFICATION.CHOOSE_ACCOUNT);
        // const options = atom.notifications.addInfo.mock.calls[0][1];
        // expect(options.buttons).toHaveLength(2);
        // expect(options.buttons[0].text).toStrictEqual(TEST_EMAIL);
        // expect(options.buttons[1].text).toStrictEqual(NOTIFICATION.USE_DIFFERENT_ACCOUNT);
        // expect(options.dismissable).toBe(true);
    });
});

describe("askPublicOrPrivate",  () => {
    const repoPath = randomRepoPath();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("askPublicOrPrivate",  async () => {
        const handler = new initHandler(repoPath, "ACCESS_TOKEN")
        await handler.askPublicOrPrivate({});
        expect(atom.notifications.addInfo).toHaveBeenCalledTimes(1);
        const msg = getPublicPrivateMsg(repoPath);
        expect(atom.notifications.addInfo.mock.calls[0][0]).toStrictEqual(msg);
        const options = atom.notifications.addInfo.mock.calls[0][1];
        expect(options.buttons).toHaveLength(2);
        expect(options.buttons[0].text).toStrictEqual(NOTIFICATION.PUBLIC);
        expect(options.buttons[1].text).toStrictEqual(NOTIFICATION.PRIVATE);
        expect(options.dismissable).toBe(true);
    });
});
