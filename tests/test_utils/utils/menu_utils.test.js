import fs from "fs";
import yaml from "js-yaml";
import untildify from "untildify";

import {
    generateMenu,
    generateRightClickMenu,
    MenuOptions,
    updateContextMenu,
    updateMenu
} from "../../../lib/utils/menu_utils";
import {
    buildAtomEnv,
    getConfigFilePath,
    getUserFilePath,
    randomBaseRepoPath,
    randomRepoPath
} from "../../helpers/helpers";


describe("generateMenu",  () => {
    const repoPath = randomRepoPath();
    const baseRepoPath = randomBaseRepoPath();
    const userFilePath = getUserFilePath(baseRepoPath);
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
        global.atom.project.getPaths.mockReturnValue([undefined]);
        const menu = generateMenu();
        const menuOptions = menu[0]['submenu'][0]['submenu'];
        expect(menuOptions).toHaveLength(1);
        expect(menuOptions[0]).toStrictEqual(MenuOptions.AUTHENTICATE)
    });

    test("User not connected: Repo Opened", () => {
        global.atom.project.getPaths.mockReturnValue([repoPath]);
        const menu = generateMenu();
        const menuOptions = menu[0]['submenu'][0]['submenu'];
        expect(menuOptions).toHaveLength(1);
        expect(menuOptions[0]).toStrictEqual(MenuOptions.AUTHENTICATE)
    });

    test("User is connected: No Repo Opened", () => {
        fs.writeFileSync(userFilePath, yaml.safeDump(userData));
        global.atom.project.getPaths.mockReturnValue([undefined]);
        const menu = generateMenu();
        const menuOptions = menu[0]['submenu'][0]['submenu'];
        expect(menuOptions).toHaveLength(1);
        expect(menuOptions[0]).toStrictEqual(MenuOptions.LOGOUT)
    });

    test("User is connected: Repo Opened and NOT connected", () => {
        fs.writeFileSync(userFilePath, yaml.safeDump(userData));
        global.atom.project.getPaths.mockReturnValue([repoPath]);
        const config = {'repos': {}};
        fs.writeFileSync(configPath, yaml.safeDump(config));

        const menu = generateMenu();

        const menuOptions = menu[0]['submenu'][0]['submenu'];
        expect(menuOptions).toHaveLength(2);
        expect(menuOptions[0]).toStrictEqual(MenuOptions.LOGOUT)
        expect(menuOptions[1]).toStrictEqual(MenuOptions.CONNECT_REPO)
    });

    test("User is connected: Repo Opened and not connected", () => {
        fs.writeFileSync(userFilePath, yaml.safeDump(userData));
        global.atom.project.getPaths.mockReturnValue([repoPath]);
        const config = {'repos': {}};
        config.repos[repoPath] = {'branches': {}};
        fs.writeFileSync(configPath, yaml.safeDump(config));

        const menu = generateMenu();

        const menuOptions = menu[0]['submenu'][0]['submenu'];
        expect(menuOptions).toHaveLength(4);
        expect(menuOptions[0]).toStrictEqual(MenuOptions.LOGOUT)
        expect(menuOptions[1]).toStrictEqual(MenuOptions.DISCONNECT_REPO)
        expect(menuOptions[2]).toStrictEqual(MenuOptions.REPO_PLAYBACK)
        expect(menuOptions[3]).toStrictEqual(MenuOptions.FILE_PLAYBACK)
    });

});


describe("generateRightClickMenu",  () => {
    const repoPath = randomRepoPath();
    const baseRepoPath = randomBaseRepoPath();
    const userFilePath = getUserFilePath(baseRepoPath);
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
        global.atom.project.getPaths.mockReturnValue([undefined]);
        const menu = generateRightClickMenu();
        const menuOptions = menu['atom-text-editor'][0]['submenu'];
        expect(menuOptions).toHaveLength(1);
        expect(menuOptions[0]).toStrictEqual(MenuOptions.AUTHENTICATE)
    });

    test("User not connected: Repo Opened", () => {
        global.atom.project.getPaths.mockReturnValue([repoPath]);
        const menu = generateRightClickMenu();
        const menuOptions = menu['atom-text-editor'][0]['submenu'];
        expect(menuOptions).toHaveLength(1);
        expect(menuOptions[0]).toStrictEqual(MenuOptions.AUTHENTICATE)
    });

    test("User is connected: No Repo Opened", () => {
        fs.writeFileSync(userFilePath, yaml.safeDump(userData));
        global.atom.project.getPaths.mockReturnValue([undefined]);
        const menu = generateRightClickMenu();
        const menuOptions = menu['atom-text-editor'][0]['submenu'];
        expect(menuOptions).toHaveLength(1);
        expect(menuOptions[0]).toStrictEqual(MenuOptions.LOGOUT)
    });

    test("User is connected: Repo Opened and NOT connected", () => {
        fs.writeFileSync(userFilePath, yaml.safeDump(userData));
        global.atom.project.getPaths.mockReturnValue([repoPath]);
        const config = {'repos': {}};
        fs.writeFileSync(configPath, yaml.safeDump(config));

        const menu = generateRightClickMenu();
        const menuOptions = menu['atom-text-editor'][0]['submenu'];
        expect(menuOptions).toHaveLength(2);
        expect(menuOptions[0]).toStrictEqual(MenuOptions.LOGOUT)
        expect(menuOptions[1]).toStrictEqual(MenuOptions.CONNECT_REPO)
    });

    test("User is connected: Repo Opened and not connected", () => {
        fs.writeFileSync(userFilePath, yaml.safeDump(userData));
        global.atom.project.getPaths.mockReturnValue([repoPath]);
        const config = {'repos': {}};
        config.repos[repoPath] = {'branches': {}};
        fs.writeFileSync(configPath, yaml.safeDump(config));

        const menu = generateRightClickMenu();

        const menuOptions = menu['atom-text-editor'][0]['submenu'];
        expect(menuOptions).toHaveLength(4);
        expect(menuOptions[0]).toStrictEqual(MenuOptions.LOGOUT)
        expect(menuOptions[1]).toStrictEqual(MenuOptions.DISCONNECT_REPO)
        expect(menuOptions[2]).toStrictEqual(MenuOptions.REPO_PLAYBACK)
        expect(menuOptions[3]).toStrictEqual(MenuOptions.FILE_PLAYBACK)
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
        global.atom.project.getPaths.mockReturnValue([undefined]);
        global.atom.menu.add.mockReturnValue("MockValue");
        updateMenu();
        expect(global.menuDisposable).toStrictEqual("MockValue");
        expect(global.atom.menu.sortPackagesMenu).toHaveBeenCalledTimes(1);
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
        global.atom.project.getPaths.mockReturnValue([undefined]);
        global.atom.contextMenu.add.mockReturnValue("MockValue");
        updateContextMenu();
        expect(global.contextMenuDisposable).toStrictEqual("MockValue");
    })

});
