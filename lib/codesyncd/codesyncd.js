'use babel';

import { RESTART_DAEMON_AFTER } from "../constants";
import { populateBuffer } from "./populate_buffer";
import { bufferHandler } from "./handlers/buffer_handler";


export const recallDaemon = (statusBarItem) => {
    // Do not run daemon in case of tests
    if (global.IS_CODESYNC_DEV) return;
    // Recall daemon after X seconds
    setTimeout(() => {
        populateBuffer(true);
        // Buffer Handler
        const handler = new bufferHandler(statusBarItem);
        handler.run();
    }, RESTART_DAEMON_AFTER);
};
