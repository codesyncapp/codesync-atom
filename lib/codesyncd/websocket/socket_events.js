'use babel';

import {STATUS_BAR_MSGS} from "../../constants";
import {logMsg} from "../../utils/common";
import {DiffsHandler} from "../handlers/diffs_handler";
import {DiffHandler} from "../handlers/diff_handler";
import {recallDaemon} from "../codesyncd";
import {statusBarMsgs} from "../utils";
import {markUsersInactive} from "../../utils/auth_utils";
import {CodeSyncState, CODESYNC_STATES} from "../../utils/state_utils";

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
        this.statusBarMsgsHandler = new statusBarMsgs(statusBarItem);
    }

    onInvalidAuth() {
        errorCount = logMsg(STATUS_BAR_MSGS.ERROR_SENDING_DIFF, errorCount);
        this.statusBarMsgsHandler.update(STATUS_BAR_MSGS.AUTHENTICATION_FAILED);
        // Mark user as inactive in user.yml
        markUsersInactive(false);
        return recallDaemon(this.statusBarItem);
    }

    async onValidAuth() {
        const canSendDiffs = CodeSyncState.get(CODESYNC_STATES.DIFFS_SEND_LOCK_ACQUIRED);
        if (!canSendDiffs) return recallDaemon(this.statusBarItem);
        errorCount = 0;
        // Update status bar msg
        this.statusBarMsgsHandler.update(STATUS_BAR_MSGS.DEFAULT);
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
            this.statusBarMsgsHandler.update(STATUS_BAR_MSGS.DEFAULT);
        } else {
            errorCount = logMsg(`no valid diff, diffs count: ${diffsCount}`, errorCount);
        }
        // Recall daemon
        return recallDaemon(this.statusBarItem);
    }

    onSyncSuccess(diffFilePath) {
        // Update status bar msg
        this.statusBarMsgsHandler.update(STATUS_BAR_MSGS.DEFAULT);
        const canSendDiffs = CodeSyncState.get(CODESYNC_STATES.DIFFS_SEND_LOCK_ACQUIRED);
        if (!canSendDiffs) return;
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
