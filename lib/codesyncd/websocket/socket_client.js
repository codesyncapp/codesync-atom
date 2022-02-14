'use babel';

import {client} from "websocket";
import {
    CONNECTION_ERROR_MESSAGE,
    SOCKET_CONNECT_ERROR_CODES,
    SOCKET_ERRORS,
    WEBSOCKET_ENDPOINT
} from "../../constants";
import {logMsg} from "../../utils/common";
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
            const errStr = error.toString();
            if (!SOCKET_CONNECT_ERROR_CODES.filter(err => error.code === err).length) {
                console.log(`Socket Connect Failed: ${error.code}, ${errStr}`);
            }
            errorCount = logMsg(CONNECTION_ERROR_MESSAGE, errorCount);
            return recallDaemon(that.statusBarItem, true, true);
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
            const msg = `Socket Connection Error: ${error.code}, ${error.toString()}`;
            if (!SOCKET_CONNECT_ERROR_CODES.filter(err => error.code === err).length) {
                console.log(msg);
            }
            errorCount = logMsg(msg, errorCount);
            that.resetGlobals();
        });

        connection.on('close', function () {
            that.resetGlobals();
        });

        // Iterate repoDiffs and send to server
        const webSocketEvents = new SocketEvents(this.statusBarItem, this.repoDiffs, this.accessToken);

        connection.on('message', function (message) {
            try {
                webSocketEvents.onMessage(message);
            } catch (e) {
                errorCount = logMsg(`${SOCKET_ERRORS.ERROR_MSG_RECEIVE}, ${e.stack}`, errorCount);
            }
        });
    };
}
