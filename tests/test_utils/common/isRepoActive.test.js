import fs from "fs";
import yaml from "js-yaml";
import { isRepoActive, readYML } from "../../../lib/utils/common";
import {getConfigFilePath, randomBaseRepoPath} from "../../helpers/helpers";

const baseRepoPath = randomBaseRepoPath();
const configPath = getConfigFilePath(baseRepoPath);

const fileData = {"repos": {"path1": {}, "path2": {is_disconnected: true}}};

beforeAll(() => {
    fs.mkdirSync(baseRepoPath, { recursive: true });
    fs.writeFileSync(configPath, yaml.safeDump(fileData));
});

afterAll(() => {
    fs.rmdirSync(baseRepoPath, { recursive: true });
});

test('Active Repo', () => {
    const config = readYML(configPath);
    expect(isRepoActive(config, "path1")).toBe(true);
});

test('Disconnected Repo', () => {
    const config = readYML(configPath);
    expect(isRepoActive(config, "path2")).toBe(false);
});
