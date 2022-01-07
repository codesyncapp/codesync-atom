'use babel';

import {STATUS_BAR_MSGS} from "../../constants";
import {logMsg, updateStatusBarItem} from "../../utils/common";
import {DiffsHandler} from "../handlers/diffs_handler";
import {DiffHandler} from "../handlers/diff_handler";
import {recallDaemon} from "../codesyncd";


const EVENT_TYPES = {
    AUTH: 'auth',
    SYNC: 'sync'
};

let errorCount = 0;

export class SocketEvents {

    constructor(statusBarItem, repoDiffs, accessToken) {
        this.connection = global.socketConnection;
        this.statusBarItem = statusBarItem;
        this.repoDiffs = repoDiffs;
        this.accessToken = accessToken;
    }

    onInvalidAuth() {
        errorCount = logMsg(STATUS_BAR_MSGS.ERROR_SENDING_DIFF, errorCount);
        updateStatusBarItem(this.statusBarItem, STATUS_BAR_MSGS.AUTHENTICATION_FAILED);
        return recallDaemon(this.statusBarItem);
    }

    async onValidAuth() {
        errorCount = 0;
        // Update status bar msg
        updateStatusBarItem(this.statusBarItem, STATUS_BAR_MSGS.SYNCING);
        let diffsCount = 0;
        // Send diffs
        let validDiffs = [];
        for (const repoDiff of this.repoDiffs) {
            diffsCount += repoDiff.file_to_diff.length;
            const diffsHandler = new DiffsHandler(repoDiff, this.accessToken);
            const diffs = await diffsHandler.run();
            validDiffs = validDiffs.concat(diffs);
        }
        if (validDiffs.length) {
            this.connection.send(JSON.stringify({"diffs": validDiffs}));
        } else {
            errorCount = logMsg(`no valid diff, diffs count: ${diffsCount}`, errorCount);
        }
        // Recall daemon
        return recallDaemon(this.statusBarItem);
    }

    onSyncSuccess(diffFilePath) {
        // Update status bar msg
        updateStatusBarItem(this.statusBarItem, STATUS_BAR_MSGS.SYNCING);
        DiffHandler.removeDiffFile(diffFilePath);
    }

    async onMessage(message) {
        if (!message || message.type !== 'utf8') return false;
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
