'use babel';

import path from "path";
import { generateSettings } from "../settings";


export class pathUtils {

    constructor(repoPath, branch) {
        this.repoPath = repoPath;
        this.formattedRepoPath = pathUtils.formatRepoPath(repoPath);
        this.branch = branch;
        this.settings = generateSettings();
    }

    static getProjectPath = () => {
        if (atom.project && atom.project.getPaths().length) {
            return atom.project.getPaths()[0];
        }
        return "";
    }

    static formatRepoPath = (repoPath) => {
        return repoPath.replace(":", "");
    };

    getOriginalsRepoPath = () => {
        return path.join(this.settings.ORIGINALS_REPO, this.formattedRepoPath);
    };

    getOriginalsRepoBranchPath = () => {
        return path.join(this.getOriginalsRepoPath(), this.branch);
    };

    getShadowRepoPath = () => {
        return path.join(this.settings.SHADOW_REPO, this.formattedRepoPath);
    };

    getShadowRepoBranchPath = () => {
        return path.join(this.getShadowRepoPath(), this.branch);
    };

    getDeletedRepoPath = () => {
        return path.join(this.settings.DELETED_REPO, this.formattedRepoPath);
    };

    getDeletedRepoBranchPath = () => {
        return path.join(this.getDeletedRepoPath(), this.branch);
    };

    getDiffsRepo = () => {
        return path.join(this.settings.DIFFS_REPO);
    }
}
