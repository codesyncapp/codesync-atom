import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import untildify from "untildify";

import {
    generateMenu,
    generateRightClickMenu,
    MenuOptions,
    updateContextMenu,
    updateMenu
} from "../../lib/utils/menu_utils";
import {
    addUser,
    buildAtomEnv,
    Config,
    getConfigFilePath,
    randomBaseRepoPath,
    randomRepoPath
} from "../helpers/helpers";
import { SYNCIGNORE } from "../../lib/constants";


describe("generateMenu",  () => {
    const repoPath = randomRepoPath();
    const baseRepoPath = randomBaseRepoPath();
    const configPath = getConfigFilePath(baseRepoPath);

    beforeEach(() => {
        jest.clearAllMocks();
        buildAtomEnv();
        untildify.mockReturnValue(baseRepoPath);
        fs.mkdirSync(baseRepoPath, {recursive: true});
        fs.mkdirSync(repoPath, {recursive: true});
    });

    afterEach(() => {
        fs.rmSync(repoPath, { recursive: true, force: true });
        fs.rmSync(baseRepoPath, { recursive: true, force: true });
    });

    test("User not connected; No Repo Opened", () => {
        atom.project.getPaths.mockReturnValue([undefined]);
        const menu = generateMenu();
        const menuOptions = menu[0]['submenu'][0]['submenu'];
        expect(menuOptions).toHaveLength(1);
        expect(menuOptions[0]).toStrictEqual(MenuOptions.AUTHENTICATE)
    });

    test("User not connected: Repo Opened", () => {
        atom.project.getPaths.mockReturnValue([repoPath]);
        const menu = generateMenu();
        const menuOptions = menu[0]['submenu'][0]['submenu'];
        expect(menuOptions).toHaveLength(1);
        expect(menuOptions[0]).toStrictEqual(MenuOptions.AUTHENTICATE)
    });

    test("User is connected: No Repo Opened", () => {
        addUser(baseRepoPath);
        atom.project.getPaths.mockReturnValue([undefined]);
        const menu = generateMenu();
        const menuOptions = menu[0]['submenu'][0]['submenu'];
        expect(menuOptions).toHaveLength(1);
        expect(menuOptions[0]).toStrictEqual(MenuOptions.LOGOUT)
    });

    test("User is connected: Repo Opened and NOT connected", () => {
        addUser(baseRepoPath);
        atom.project.getPaths.mockReturnValue([repoPath]);
        const config = {'repos': {}};
        fs.writeFileSync(configPath, yaml.safeDump(config));

        const menu = generateMenu();

        const menuOptions = menu[0]['submenu'][0]['submenu'];
        expect(menuOptions).toHaveLength(2);
        expect(menuOptions[0]).toStrictEqual(MenuOptions.CONNECT_REPO);
        expect(menuOptions[1]).toStrictEqual(MenuOptions.LOGOUT);
    });

    test("User is connected: Repo Opened and connected", () => {
        addUser(baseRepoPath);
        atom.project.getPaths.mockReturnValue([repoPath]);
        const configUtil = new Config(repoPath, configPath);
        configUtil.addRepo();

        const menu = generateMenu();

        const menuOptions = menu[0]['submenu'][0]['submenu'];
        expect(menuOptions).toHaveLength(4);
        expect(menuOptions[0]).toStrictEqual(MenuOptions.FILE_PLAYBACK);
        expect(menuOptions[1]).toStrictEqual(MenuOptions.REPO_PLAYBACK);
        expect(menuOptions[2]).toStrictEqual(MenuOptions.DISCONNECT_REPO);
        expect(menuOptions[3]).toStrictEqual(MenuOptions.LOGOUT);
    });

    test("Sub directory is opened", () => {
        addUser(baseRepoPath);
        const subDir = path.join(repoPath, "directory");
        atom.project.getPaths.mockReturnValue([subDir]);
        const configUtil = new Config(repoPath, configPath);
        configUtil.addRepo();

        const menu = generateMenu();

        const menuOptions = menu[0]['submenu'][0]['submenu'];
        expect(menuOptions).toHaveLength(4);
        expect(menuOptions[0]).toStrictEqual(MenuOptions.FILE_PLAYBACK);
        expect(menuOptions[1]).toStrictEqual(MenuOptions.REPO_PLAYBACK);
        expect(menuOptions[2]).toStrictEqual(MenuOptions.DISCONNECT_REPO);
        expect(menuOptions[3]).toStrictEqual(MenuOptions.LOGOUT);
    });

    test("Sync ignored sub directory", () => {
        const subDirName = "directory";
        const subDir = path.join(repoPath, "directory");
        // Add subDir to .syncignore
        const syncignorePath = path.join(repoPath, SYNCIGNORE);
        fs.writeFileSync(syncignorePath, subDirName);
        atom.project.getPaths.mockReturnValue([subDir]);
        const configUtil = new Config(repoPath, configPath);
        configUtil.addRepo();
        addUser(baseRepoPath);
        const menu = generateMenu();
        const menuOptions = menu[0]['submenu'][0]['submenu'];
        expect(menuOptions).toHaveLength(2);
        expect(menuOptions[0]).toStrictEqual(MenuOptions.OPEN_SYNCIGNORE)
        expect(menuOptions[1]).toStrictEqual(MenuOptions.LOGOUT);
    });
});


describe("generateRightClickMenu",  () => {
    const repoPath = randomRepoPath();
    const baseRepoPath = randomBaseRepoPath();
    const userData = {"dummy_email": {access_token: "ABC"}};
    const configPath = getConfigFilePath(baseRepoPath);

    beforeEach(() => {
        jest.clearAllMocks();
        buildAtomEnv();
        untildify.mockReturnValue(baseRepoPath);
        fs.mkdirSync(baseRepoPath, {recursive: true});
        fs.mkdirSync(repoPath, {recursive: true});
    });

    afterEach(() => {
        fs.rmSync(repoPath, { recursive: true, force: true });
        fs.rmSync(baseRepoPath, { recursive: true, force: true });
    });

    test("User not connected; No Repo Opened", () => {
        atom.project.getPaths.mockReturnValue([undefined]);
        const menu = generateRightClickMenu();
        const menuOptions = menu['atom-text-editor'][0]['submenu'];
        expect(menuOptions).toHaveLength(1);
        expect(menuOptions[0]).toStrictEqual(MenuOptions.AUTHENTICATE)
    });

    test("User not connected: Repo Opened", () => {
        atom.project.getPaths.mockReturnValue([repoPath]);
        const menu = generateRightClickMenu();
        const menuOptions = menu['atom-text-editor'][0]['submenu'];
        expect(menuOptions).toHaveLength(1);
        expect(menuOptions[0]).toStrictEqual(MenuOptions.AUTHENTICATE)
    });

    test("User is connected: No Repo Opened", () => {
        addUser(baseRepoPath);
        atom.project.getPaths.mockReturnValue([undefined]);
        const menu = generateRightClickMenu();
        const menuOptions = menu['atom-text-editor'][0]['submenu'];
        expect(menuOptions).toHaveLength(1);
        expect(menuOptions[0]).toStrictEqual(MenuOptions.LOGOUT)
    });

    test("User is connected: Repo Opened and NOT connected", () => {
        addUser(baseRepoPath);
        atom.project.getPaths.mockReturnValue([repoPath]);
        const config = {'repos': {}};
        fs.writeFileSync(configPath, yaml.safeDump(config));

        const menu = generateRightClickMenu();
        const menuOptions = menu['atom-text-editor'][0]['submenu'];
        expect(menuOptions).toHaveLength(2);
        expect(menuOptions[0]).toStrictEqual(MenuOptions.CONNECT_REPO);
        expect(menuOptions[1]).toStrictEqual(MenuOptions.LOGOUT);
    });

    test("User is connected: Repo Opened and connected", () => {
        addUser(baseRepoPath);
        atom.project.getPaths.mockReturnValue([repoPath]);
        const configUtil = new Config(repoPath, configPath);
        configUtil.addRepo();

        const menu = generateRightClickMenu();

        const menuOptions = menu['atom-text-editor'][0]['submenu'];
        expect(menuOptions).toHaveLength(4);
        expect(menuOptions[0]).toStrictEqual(MenuOptions.FILE_PLAYBACK)
        expect(menuOptions[1]).toStrictEqual(MenuOptions.REPO_PLAYBACK);
        expect(menuOptions[2]).toStrictEqual(MenuOptions.DISCONNECT_REPO);
        expect(menuOptions[3]).toStrictEqual(MenuOptions.LOGOUT);
    });
});

describe("updateMenu",  () => {

    const baseRepoPath = randomBaseRepoPath();

    beforeEach(() => {
        jest.clearAllMocks();
        buildAtomEnv();
        untildify.mockReturnValue(baseRepoPath);
    });

    test("User is connected: Repo Opened and not connected", () => {
        global.menuDisposable = {
            dispose: jest.fn()
        };
        atom.project.getPaths.mockReturnValue([undefined]);
        atom.menu.add.mockReturnValue("MockValue");
        updateMenu();
        expect(global.menuDisposable).toStrictEqual("MockValue");
        expect(atom.menu.sortPackagesMenu).toHaveBeenCalledTimes(1);
    })

});


describe("updateContextMenu",  () => {

    const baseRepoPath = randomBaseRepoPath();

    beforeEach(() => {
        jest.clearAllMocks();
        buildAtomEnv();
        untildify.mockReturnValue(baseRepoPath);
    });

    test("User is connected: Repo Opened and not connected", () => {
        global.contextMenuDisposable = {
            dispose: jest.fn()
        };
        atom.project.getPaths.mockReturnValue([undefined]);
        atom.contextMenu.add.mockReturnValue("MockValue");
        updateContextMenu();
        expect(global.contextMenuDisposable).toStrictEqual("MockValue");
    })

});
