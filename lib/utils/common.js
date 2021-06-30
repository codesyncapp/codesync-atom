'use babel';

import fs from 'fs';
import yaml from 'js-yaml';


export const readFile = (filePath) => {
	return fs.readFileSync(filePath, "utf8");
};

export const readYML = (filePath) => {
    try {
        return yaml.load(readFile(filePath));
    } catch (e) {
        return;
    }
};


