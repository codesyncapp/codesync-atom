import path from "path";
import { generateSettings } from "../settings";


export function formatPath(repoPath) {
    return repoPath.replace(":", "");
}

export class pathUtils {

    constructor(repoPath, branch) {
        this.repoPath = repoPath;
        this.formattedRepoPath = formatPath(repoPath);
        this.branch = branch;
        this.settings = generateSettings();
    }

    getOriginalsRepoBranchPath = () => {
        return path.join(this.settings.ORIGINALS_REPO, this.formattedRepoPath, this.branch);
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
}
