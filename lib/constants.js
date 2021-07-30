'use babel';

const untildify = require('untildify');

export const CODESYNC_ROOT = untildify('~/.codesync');
export const DIFFS_REPO = `${CODESYNC_ROOT}/.diffs/.atom`;
export const ORIGINALS_REPO = `${CODESYNC_ROOT}/.originals`;
export const SHADOW_REPO = `${CODESYNC_ROOT}/.shadow`;
export const DELETED_REPO = `${CODESYNC_ROOT}/.deleted`;
export const CONFIG_PATH = `${CODESYNC_ROOT}/config.yml`;
export const USER_PATH = `${CODESYNC_ROOT}/user.yml`;
export const SEQUENCE_TOKEN_PATH = `${CODESYNC_ROOT}/sequence_token.yml`;

export const SYNCIGNORE = ".syncignore";
export const GITIGNORE = ".gitignore";

export const DIFF_SOURCE = 'atom';
export const DEFAULT_BRANCH = 'default';
export const GIT_REPO = '.git/';
// TODO: Use standard .gitignore
export const IGNOREABLE_REPOS = [
    ".git",
    "node_modules",
    ".DS_Store",
    ".idea",
];
export const DATETIME_FORMAT = 'UTC:yyyy-mm-dd HH:MM:ss.l';
export const RESTART_DAEMON_AFTER = 5000;

// export const CODESYNC_DOMAIN = '127.0.0.1:8000';
// export const CODESYNC_HOST = 'http://127.0.0.1:8000';
export const CODESYNC_DOMAIN = "codesync-server.herokuapp.com";
export const CODESYNC_HOST = 'https://codesync-server.herokuapp.com';
export const API_ENDPOINT = `${CODESYNC_HOST}/v1`;
export const API_FILES = `${API_ENDPOINT}/files`;
export const API_INIT = `${API_ENDPOINT}/init`;
export const API_USERS = `${API_ENDPOINT}/users`;
export const API_HEALTHCHECK = `${CODESYNC_HOST}/healthcheck`;
export const AUTH0_AUTHORIZE = `${CODESYNC_HOST}/authorize`;
export const WEBSOCKET_ENDPOINT = `ws://${CODESYNC_DOMAIN}/v1/websocket`;
export const WEB_APP_URL = "https://www.codesync.com"
export const PLANS_URL = `${WEB_APP_URL}/plans`;

// Diff related constants
export const DIFF_FILES_PER_ITERATION = 50;
export const REQUIRED_DIFF_KEYS = ['repo_path', 'branch', 'file_relative_path', 'created_at'];
export const REQUIRED_FILE_RENAME_DIFF_KEYS = ['old_abs_path', 'new_abs_path', 'old_rel_path', 'new_rel_path'];
export const REQUIRED_DIR_RENAME_DIFF_KEYS = ['old_path', 'new_path'];
export const DIFF_SIZE_LIMIT = 16 * 1000 * 1000;

// AWS constants
export const AWS_REGION = 'us-east-1';
export const CLIENT_LOGS_GROUP_NAME = 'client-logs';
export const LOGO_URL = "https://codesync-images.s3.amazonaws.com/icon.png";

// Error messages
export const CONNECTION_ERROR_MESSAGE = 'Error => Server is not available. Please try again in a moment';

// Auth0
export const Auth0URLs = {
    // Pre defined ports
    PORTS: [
        49165,
        49170,
        49175,
        49180,
        50100,
        50105,
        50110,
        50115,
        50120,
        49160
    ]
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
    TRACK_IT: "Tract it",
    WELCOME_MSG: "Welcome to CodeSync!",
    LOGIN_SUCCESS: "Successfully Authenticated. Please check your IDE for further instructions",
    CONNECT_REPO: "Connect your repo with CodeSync",
    CONNECT_AFTER_JOIN: "Successfully logged in to CodeSync. Let's connect your repo",
    CHOOSE_ACCOUNT: "Choose account to sync your repo",
    USE_DIFFERENT_ACCOUNT: "Use differnet account",
    PUBLIC_OR_PRIVATE: "Do you want to make the repo public?",
    REPO_SYNCED: "Repo synced successfully! Track it at",
    BRANCH_SYNCED: "Branch synced successfully! Track it at",
    UPDATE_SYNCIGNORE: "Add files in .syncignore you don't wnat to sync, save it and press continue!",
    SYNC_FAILED: "Ouch! Sync failed. Please try again a moment later",
    REPOS_LIMIT_BREACHED: "Repo size exceeds the limit. Allowed repo size is",
    FILES_LIMIT_BREACHED: "FIles count exceeds the limit.",
    SERVICE_NOT_AVAILABLE: "Service is unavailable. Please try again in a moment.",
    UPGRADE_PLAN: `Upgrade your plan: ${PLANS_URL}`,
    INIT_CANCELLED: "Init process was cancelled",
    NO_VALID_ACCOUNT: "No valid account found",
    REPO_IN_SYNC: "Repo is in sync with CodeSync",
    AUTHENTICATION_FAILED: "Authentication failed. You need to login again",
    AUTHENTICATED_WITH_NO_REPO_OPENED: "Successfully Authenticated! You can open a repo to connect it with CodeSync",
    ERROR_SYNCING_REPO: "Error syncing repo.",
    ERROR_SYNCING_BRANCH: "Error syncing branch",
    AUTH_FAILED_FOR_DIFF: "Auth failed while sending diff"
};

export const STATUS_BAR_MSGS = {
    ERROR_SENDING_DIFF: 'Error sending diff => Authentication failed',
    DEFAULT: ' Watching changes',
    SYNCING: ' Syncing changes',
    AUTHENTICATION_FAILED: ' Authentication failed. Click to Login!',
    REPO_BEING_SYNCED: ' Code is being synced',
    SERVER_DOWN: ' Offline',
    GETTING_READY: ' Getting ready',
    NO_REPO_OPEN: ' No project is open'
};

export const DAEMON_MSG_TILE_ID = "codesync-daemon-msg";
