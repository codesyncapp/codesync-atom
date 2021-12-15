'use babel';

import {putLogEvent} from "../../logger";
import {STATUS_BAR_MSGS} from "../../constants";
import {readYML, updateStatusBarItem} from "../../utils/common";
import {generateSettings} from "../../settings";
import {DiffsHandler} from "../handlers/diffs_handler";
import {DiffHandler} from "../handlers/diff_handler";


const EVENT_TYPES = {
    AUTH: 'auth',
    SYNC: 'sync'
};

export class WebSocketEvents {

    constructor(connection, statusBarItem, repoDiff) {
        this.connection = connection;
        this.statusBarItem = statusBarItem;
        this.repoDiff = repoDiff;
        const settings = generateSettings();
        const users = readYML(settings.USER_PATH) || {};
        this.configJSON = readYML(settings.CONFIG_PATH);
        this.configRepo = this.configJSON.repos[repoDiff.repoPath];
        this.accessToken = users[this.configRepo.email].access_token;
    }

    onInvalidAuth() {
        putLogEvent(STATUS_BAR_MSGS.ERROR_SENDING_DIFF);
        updateStatusBarItem(this.statusBarItem, STATUS_BAR_MSGS.AUTHENTICATION_FAILED);
    }

    async onValidAuth() {
        // Update status bar msg
        updateStatusBarItem(this.statusBarItem, STATUS_BAR_MSGS.SYNCING);
        const diffsHandler = new DiffsHandler(this.repoDiff.file_to_diff,
            this.accessToken, this.repoDiff.repoPath, this.connection);
        await diffsHandler.run();
    }

    onSyncSuccess(diffFilePath) {
        // Update status bar msg
        updateStatusBarItem(this.statusBarItem, STATUS_BAR_MSGS.SYNCING);
        DiffHandler.removeDiffFile(diffFilePath);
    }

    async onMessage(message) {
        if (message.type !== 'utf8') return false;
        const resp = JSON.parse(message.utf8Data || "{}");
        if (!resp.type) return false;
        if (resp.type === EVENT_TYPES.AUTH) {
            if (resp.status !== 200) {
                this.onInvalidAuth();
                return true;
            }
            await this.onValidAuth();
            return true;
        }
        if (resp.type === EVENT_TYPES.SYNC) {
            if (resp.status === 200) {
                this.onSyncSuccess(resp.diff_file_path);
                return true;
            }
        }
        return false;
    }
}
