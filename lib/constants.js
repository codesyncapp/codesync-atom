'use babel';

import path from "path";
import {CODESYNC_DOMAIN, CODESYNC_HOST, WEB_APP_URL} from "./settings";

export const SYNCIGNORE = ".syncignore";
export const GITIGNORE = ".gitignore";

export const DIFF_SOURCE = 'atom';
export const DEFAULT_BRANCH = 'default';
// TODO: Use standard .gitignore
export const IGNORABLE_DIRECTORIES = [
    ".git",
    "node_modules",
    ".DS_Store",
    ".idea",
];
export const DATETIME_FORMAT = 'UTC:yyyy-mm-dd HH:MM:ss.l';
export const RESTART_DAEMON_AFTER = 5000;

export const API_ENDPOINT = `${CODESYNC_HOST}/v1`;
export const API_FILES = `${API_ENDPOINT}/files`;
export const API_INIT = `${API_ENDPOINT}/init`;
export const API_USERS = `${API_ENDPOINT}/users`;
export const API_HEALTHCHECK = `${CODESYNC_HOST}/healthcheck`;
export const WEBSOCKET_ENDPOINT = `ws://${CODESYNC_DOMAIN}/v2/websocket`;
export const PLANS_URL = `${WEB_APP_URL}/pricing`;
export const UI_INSTALL_URL = `${WEB_APP_URL}/install`;

// Diff related constants
export const DIFF_FILES_PER_ITERATION = 50;
export const REQUIRED_DIFF_KEYS = ['repo_path', 'branch', 'file_relative_path', 'created_at'];
export const REQUIRED_FILE_RENAME_DIFF_KEYS = ['old_rel_path', 'new_rel_path'];
export const REQUIRED_DIR_RENAME_DIFF_KEYS = ['old_path', 'new_path'];
export const DIFF_SIZE_LIMIT = 16 * 1000 * 1000;
export const SEQUENCE_MATCHER_RATIO = 0.8;

// AWS constants
export const AWS_REGION = 'us-east-1';
export const CLIENT_LOGS_GROUP_NAME = 'client-logs';
export const LOGO_URL = "https://codesync-images.s3.amazonaws.com/icon.png";

// Error messages
export const CONNECTION_ERROR_MESSAGE = 'Error => CodeSync service is not available. Please try again in a moment';

// Auth0
export const MIN_PORT = 49152;
export const MAX_PORT = 65535;
export const Auth0URLs = {
    AUTHORIZE: `${CODESYNC_HOST}/authorize`,
    LOGOUT: `${CODESYNC_HOST}/auth-logout`,
    LOGIN_CALLBACK_PATH: "/login-callback",
};

// Notification Buttons
export const NOTIFICATION = {
    JOIN: "Join",
    CONNECT: "Connect",
    IGNORE: 'Ignore',
    LOGIN: "Login",
    YES: "Yes",
    NO: "No",
    CANCEL: "Cancel",
    CONTINUE: "Continue",
    TRACK_IT: "View on web",
    TRACK_PARENT_REPO: "View parent repo on web",
    OPEN_SYNCIGNORE: "Open .syncignore",
    UNSYNC_REPO: "Unsync",
    UNSYNC_PARENT_REPO: "Unsync parent repo",
    WELCOME_MSG: "Welcome to CodeSync!",
    LOGIN_SUCCESS: "Success! Now, switch back to Atom to connect your repo.",
    LOGIN_FAILED: "Sign up to CodeSync failed",
    CONNECT_REPO: "Connect your repo with CodeSync",
    CONNECT_AFTER_JOIN: "Successfully logged in to CodeSync. Let's connect your repo",
    CHOOSE_ACCOUNT: "Choose account to sync your repo",
    USE_DIFFERENT_ACCOUNT: "Use different account",
    PUBLIC: "Public",
    PRIVATE: "Private",
    REPO_SYNCED: "Repo synced successfully!",
    BRANCH_SYNCED: "Branch synced successfully!",
    UPDATE_SYNCIGNORE: ".syncignore has the same format as .gitignore. You can add all the files you don't want to sync to your .syncignore",
    SYNC_IGNORE_CREATED: "I've created a file called .syncignore (similar to .gitignore). You can add all the files you don't want to sync to your .syncignore",
    SYNC_FAILED: "Ouch! Sync failed. Please try again a moment later",
    REPOS_LIMIT_BREACHED: "Repo size exceeds the limit. Allowed repo size is",
    FILES_LIMIT_BREACHED: "Files count exceeds the limit.",
    SERVICE_NOT_AVAILABLE: "Service is unavailable. Please try again in a moment.",
    UPGRADE_PLAN: `Upgrade your plan: ${PLANS_URL}`,
    INIT_CANCELLED: "Init process was cancelled",
    NO_VALID_ACCOUNT: "No valid account found",
    REPO_IN_SYNC: "is in sync with CodeSync",
    AUTHENTICATION_FAILED: "Authentication failed. You need to login again",
    AUTHENTICATED_WITH_NO_REPO_OPENED: "Successfully Authenticated! You can open a repo to connect it with CodeSync",
    ERROR_SYNCING_REPO: "Error syncing repo.",
    ERROR_SYNCING_BRANCH: "Error syncing branch",
    REPO_UNSYNCED: "Repo disconnected successfully",
    REPO_UNSYNC_FAILED: "Could not unsync the repo",
    REPO_UNSYNC_CONFIRMATION: "Are you sure to continue? You won't be able to revert this!",
    REPO_UNSYNC_PARENT_CONFIRMATION: "Are you sure to unsync parent repo? You won't be able to revert this!",
    LOGGED_OUT_SUCCESSFULLY: "Successfully logged out!"
};

export const getRepoInSyncMsg = (repoPath) => {
    const repoName = path.basename(repoPath);
    return `Repo ${repoName} ${NOTIFICATION.REPO_IN_SYNC}`;
};

export const getDirectoryIsSyncedMsg = (repoPath, parentPath) => {
	const subDirName = path.basename(repoPath);
	return {
        msg: "You are good to go ✅",
        detail: `Directory ${subDirName} is in sync with CodeSync because parent repo ${parentPath} is in sync.`
    };
};

export const getDirectorySyncIgnoredMsg = (repoPath, parentPath) => {
    const subDirName = path.basename(repoPath);
	return `Directory ${subDirName} is syncignored by parent repo at ${parentPath}. To sync this directory, remove it from .syncignore`;
};

export const getPublicPrivateMsg = (repoPath) => {
    // Do you want the repo <name> public or private?
    const repoName = path.basename(repoPath);
    return `Do you want the repo ${repoName} public or private? (You can change this later)`;
};

export const STATUS_BAR_MSGS = {
    ERROR_SENDING_DIFF: 'Authentication failed while sending diffs',
    DEFAULT: '✅',
    AUTHENTICATION_FAILED: '❌, Click to authenticate!',
    SERVER_DOWN: '❌, Offline',
    GETTING_READY: '=> Getting ready',
    NO_REPO_OPEN: '=> No project is open',
    CONNECT_REPO: '❌, Click to connect repo!',
    IS_SYNCIGNORED_SUB_DIR: '❌, Repo is syncignored and not being synced!',
    NO_CONFIG: '❌, Reload required!'
};

export const DAEMON_MSG_TILE_ID = "codesync-daemon-msg";
export const RIGHT_TILE_ID = "codesync-right-tile";
export const PANEL_VIEW_ID = "codesync-view";

export class staticFiles {
    LOGIN_SUCCESS;
    LOGIN_FAILURE;

    constructor(rootPath) {
        this.LOGIN_SUCCESS = path.join(path.join(rootPath, path.join("static", "login-success.html")));
        this.LOGIN_FAILURE = path.join(path.join(rootPath, path.join("static", "login-failure.html")));
    }

}
export const FILE_UPLOAD_WAIT_TIMEOUT = 5 * 60;
export const SYNC_IGNORE_FILE_DATA = "# CodeSync won't sync the files in the .syncignore. It follows same format as .gitignore.";
// Log after 5 min, as daemon restarts after 5s so it will log after 60 iterations
export const LOG_AFTER_X_TIMES = (5 * 60) / 5;

export const SOCKET_CONNECT_ERROR_CODES = ["ECONNREFUSED", "ETIMEDOUT", "ECONNRESET"];
export const SOCKET_ERRORS = {
    ERROR_MSG_RECEIVE: 'Error receiving socket msg'
};
