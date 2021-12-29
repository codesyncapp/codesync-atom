'use babel';

import {client} from "websocket";

import {putLogEvent} from "../../logger";
import {CONNECTION_ERROR_MESSAGE, LOG_AFTER_X_TIMES, STATUS_BAR_MSGS, WEBSOCKET_ENDPOINT} from "../../constants";
import {updateStatusBarItem} from "../../utils/common";
import {recallDaemon} from "../codesyncd";
import {SocketEvents} from "./socket_events";

let errorCount = 0;

export class SocketClient {

    constructor(statusBarItem, accessToken, repoDiffs) {
        this.statusBarItem = statusBarItem;
        this.accessToken = accessToken;
        this.repoDiffs = repoDiffs;
        this.client = global.client;
    }

    resetGlobals = () => {
        this.client = null;
        global.client = null;
        global.socketConnection = null;
    }

    connect = () => {
        if (!this.client) {
            this.client = new client();
            global.client = this.client;
            this.registerEvents();
        } else {
            const socketConnection = global.socketConnection;
            if (!socketConnection) return;
            // Trigger onValidAuth for already connected socket
            const webSocketEvents = new SocketEvents(this.statusBarItem, this.repoDiffs, this.accessToken);
            webSocketEvents.onValidAuth();
        }
    };

    registerEvents = () => {
        const that = this;

        this.client.on('connectFailed', function (error) {
            that.resetGlobals();
            if (!error.toString().includes("ECONNREFUSED")) {
                console.log('Socket Connect Error: ' + error.toString());
            }
            if (errorCount === 0 || errorCount > LOG_AFTER_X_TIMES) {
                putLogEvent(CONNECTION_ERROR_MESSAGE);
            }
            if (errorCount > LOG_AFTER_X_TIMES) {
                errorCount = 0;
            }
            errorCount += 1;
            updateStatusBarItem(that.statusBarItem, STATUS_BAR_MSGS.SERVER_DOWN);
            return recallDaemon(that.statusBarItem);
        });

        this.client.on('connect', function (connection) {
            errorCount = 0;
            that.registerConnectionEvents(connection);
        });

        this.client.connect(`${WEBSOCKET_ENDPOINT}?token=${this.accessToken}`);
    };

    registerConnectionEvents = (connection) => {
        // Set connection in global
        global.socketConnection = connection;
        const that = this;

        connection.on('error', function (error) {
            putLogEvent("Socket Connection Error: " + error.toString());
            that.resetGlobals();
        });

        connection.on('close', function () {
            that.resetGlobals();
        });

        // Iterate repoDiffs and send to server
        const webSocketEvents = new SocketEvents(this.statusBarItem, this.repoDiffs, this.accessToken);

        connection.on('message', function (message) {
            webSocketEvents.onMessage(message);
        });
    };
}
