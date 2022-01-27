'use babel';

import {
  SignUpHandler,
  SyncHandler,
  unSyncHandler,
  openSyncIgnoreHandler
} from "./handlers/commands_handler";
import {
  LOGO_URL,
  NOTIFICATION,
  STATUS_BAR_MSGS,
  DAEMON_MSG_TILE_ID,
  getRepoInSyncMsg,
  getDirectoryIsSyncedMsg, 
  getDirectorySyncIgnoredMsg,
  RIGHT_TILE_ID,
  UI_INSTALL_URL,
  PANEL_VIEW_ID
} from "./constants";
import { readYML, checkSubDir } from "./utils/common";
import { generateSettings, WEB_APP_URL } from "./settings";
import { updateContextMenu, updateMenu } from "./utils/menu_utils";
import { pathUtils } from "./utils/path_utils";
import { CodeSyncState, CODESYNC_STATES } from "./utils/state_utils";
import fs from "fs";

const createRootElement = () => {
  // Create root element
  const element = document.createElement('div');
  element.classList.add('codesync-view');

  // Add image
  const imgElement = headerImg()
  element.appendChild(imgElement);
  return element;
};

const headerImg = () => {
  const imgDiv = document.createElement('div');
  imgDiv.classList.add('img');
  const img = document.createElement('img');
  img.src = LOGO_URL;
  img.classList.add('img-large');
  imgDiv.appendChild(img)
  return imgDiv;
};

export const generateView = () => {
  let viewInstance;
  const repoPath = pathUtils.getProjectPath();
  const user = CodeSyncState.get(CODESYNC_STATES.USER_EMAIL);
  const isRepoInSync = CodeSyncState.get(CODESYNC_STATES.REPO_IS_IN_SYNC);
  const isSubDir = CodeSyncState.get(CODESYNC_STATES.IS_SUB_DIR);
  const isSyncIgnored = CodeSyncState.get(CODESYNC_STATES.IS_SYNCIGNORED_SUB_DIR);

  switch (true) {
    case (!user):
      viewInstance = new LoginView();
      break;
      case (!repoPath):
        viewInstance = new OpenRepoView();
        break;  
      case (isRepoInSync && !isSubDir):
        viewInstance = new UnsyncRepoView();
        break;
      case (!isRepoInSync && !isSubDir):
        viewInstance = new ShowConnectRepoView();
        break;
      // isSubDir and isSyncIgnored
      case (!isSyncIgnored):
        viewInstance = new SyncedSubDirView();
        break;
      // isSubDir and !isSyncIgnored
      case (isSyncIgnored):
        viewInstance = new SyncIgnoredSubDirView();
        break;         
      default:
  }
  return atom.views.getView(viewInstance);;
}

export class buttonView {
    constructor(serializedState) {
      this.panel = null;
      // Create root element
      this.element = document.createElement('button');
      this.element.setAttribute("id", RIGHT_TILE_ID);
      this.element.classList.add('codesync-status-bar', 'inline-block');
      // Add image
      const img = document.createElement('img');
      img.src = LOGO_URL;
      img.classList.add('img');
      this.element.appendChild(img);
      // Create icon
      const iconSpan = document.createElement('span');
      iconSpan.textContent = ' CodeSync';
      this.element.appendChild(iconSpan);

      // Button Click Handler
      this.element.onclick = function() {
        this.panel = getCodeSyncPanel();
        if (!this.panel) {
          const view = generateView();
          this.panel = updateView(view);
        }
        // Toggle value
        this.panel.isVisible() ? this.panel.hide() : this.panel.show();
      };
    }
}

const getCodeSyncPanel = () => {
  let codeSyncPanel;
  const panels = atom.workspace.getRightPanels();
  panels.forEach((panel) => {
    if (panel.item.className === PANEL_VIEW_ID) {
      codeSyncPanel = panel;
    }
  });
  return codeSyncPanel;
};


export class panelView {

  constructor(serializedState) { }

  getElement(obj) {
    if (!obj || !obj.message) { return this.element; }
    const view = generateView();
    updateView(view);
    updateMenu();
    updateContextMenu();
    return this.element;
  }
}

const updateView = (view) => {
  let codeSyncPanel = getCodeSyncPanel();
  if (codeSyncPanel) {
      // Destroy old panel
      codeSyncPanel.destroy();
      codeSyncPanel = atom.workspace.addRightPanel({
        item: view,
        visible: true
      });
  } else {
    codeSyncPanel = atom.workspace.addRightPanel({
      item: view,
      visible: false
    });
  }
  return codeSyncPanel;
};

export class LoginView {

  constructor(serializedState) {
    this.element = createRootElement();
    this.createLoginView();
  }

  createLoginView() {
    // Login text and Join button
    let textSpan = document.createElement('h1');
    textSpan.textContent = 'Login to CodeSync';
    this.element.appendChild(textSpan);

    const btn = document.createElement('button');
    btn.classList.add("btn", "btn-primary");

    const buttonText = document.createElement('span');
    buttonText.textContent = 'Join';
    btn.appendChild(buttonText);

    btn.onclick = function() {
      SignUpHandler();
    }

    this.element.appendChild(btn);

    textSpan = document.createElement('p');
    textSpan.textContent = 'To learn more: ';

    const link = document.createElement('a');
    link.textContent = "Read our docs";
    link.href = UI_INSTALL_URL;

    textSpan.appendChild(link);
    this.element.appendChild(textSpan);
  }
}

export class ShowConnectRepoView {

  constructor(serializedState) {
    this.element = createRootElement();
    this.createConnectRepoView();
  }

  createConnectRepoView() {
    let textSpan = document.createElement('h1');
    textSpan.textContent = 'Connect your repo';
    // Button
    const btn = document.createElement('button');
    btn.classList.add("btn", "btn-primary");

    const buttonText = document.createElement('span');
    buttonText.textContent = 'Connect';
    btn.appendChild(buttonText);

    btn.onclick = function() {
      SyncHandler();
    }

    this.element.appendChild(textSpan);
    this.element.appendChild(btn);
  }

}

export class UnsyncRepoView {

  constructor(serializedState) {
    this.element = createRootElement();
    this.createUnsyncRepoView();
  }

  createUnsyncRepoView() {

    const repoPath = pathUtils.getProjectPath();
    if (!repoPath) { return; }

    let textSpan = document.createElement('h3');
    textSpan.textContent = getRepoInSyncMsg(repoPath);
    this.element.appendChild(textSpan);

    const settings = generateSettings();
    if (!fs.existsSync(settings.CONFIG_PATH)) return;

    const config = readYML(settings.CONFIG_PATH);
    if (!repoPath in config.repos) return;

    const repoId = config.repos[repoPath].id;
    textSpan = document.createElement('h3');
    textSpan.textContent = `${NOTIFICATION.TRACK_IT} `;

    const trackLink = document.createElement('a');
    trackLink.textContent = "here";
    trackLink.href = `${WEB_APP_URL}/repos/${repoId}/playback`;
    textSpan.appendChild(trackLink);
    this.element.appendChild(textSpan);

    const btn = document.createElement('button');
    btn.classList.add("btn", "btn-primary");

    const buttonText = document.createElement('span');
    buttonText.textContent = 'Unsync';
    btn.appendChild(buttonText);
    btn.onclick = function() {
      unSyncHandler();
    }
    this.element.appendChild(btn);
  }
}

export class SyncedSubDirView {

  constructor(serializedState) {
    this.element = createRootElement();
    this.create();
  }

  create() {
    const repoPath = pathUtils.getProjectPath();
    if (!repoPath) { return; }

    let textSpan = document.createElement('h2');

    const subDirResult = checkSubDir(repoPath);
    const json = getDirectoryIsSyncedMsg(repoPath, subDirResult.parentRepo);
    
    textSpan.textContent = json.msg;
    this.element.appendChild(textSpan);

    textSpan = document.createElement('h3');
    textSpan.textContent = json.detail;
    this.element.appendChild(textSpan);
    
    const settings = generateSettings();
    const config = readYML(settings.CONFIG_PATH);
    const repoId = config.repos[subDirResult.parentRepo].id;

    textSpan = document.createElement('h3');
    textSpan.textContent = `${NOTIFICATION.TRACK_PARENT_REPO} `;

    const trackLink = document.createElement('a');
    trackLink.textContent = "here";
    trackLink.href = `${WEB_APP_URL}/repos/${repoId}/playback`;
    textSpan.appendChild(trackLink);
    this.element.appendChild(textSpan);

    const btn = document.createElement('button');
    btn.classList.add("btn", "btn-primary");

    const buttonText = document.createElement('span');
    buttonText.textContent = 'Unsync parent repo';
    btn.appendChild(buttonText);
    btn.onclick = function() {
      unSyncHandler();
    }
    this.element.appendChild(btn);
  }
}

export class SyncIgnoredSubDirView {

  constructor(serializedState) {
    this.element = createRootElement();
    this.create();
  }

  create() {

    const repoPath = pathUtils.getProjectPath();
    if (!repoPath) { return; }

    let textSpan = document.createElement('h3');

    const subDirResult = checkSubDir(repoPath);
    textSpan.textContent = getDirectorySyncIgnoredMsg(repoPath, subDirResult.parentRepo);
    this.element.appendChild(textSpan);

    const settings = generateSettings();

    const config = readYML(settings.CONFIG_PATH);
    const repoId = config.repos[subDirResult.parentRepo].id;

    textSpan = document.createElement('h3');
    textSpan.textContent = `${NOTIFICATION.TRACK_PARENT_REPO} `;

    const trackLink = document.createElement('a');
    trackLink.textContent = "here";
    trackLink.href = `${WEB_APP_URL}/repos/${repoId}/playback`;
    textSpan.appendChild(trackLink);
    this.element.appendChild(textSpan);

    let btn = document.createElement('button');
    btn.classList.add("btn", "btn-primary");

    let buttonText = document.createElement('span');
    buttonText.textContent = NOTIFICATION.OPEN_SYNCIGNORE;
    btn.appendChild(buttonText);
    btn.onclick = function() {
      openSyncIgnoreHandler();
    }
    this.element.appendChild(btn);

    btn = document.createElement('button');
    btn.classList.add("btn", "btn-primary");

    buttonText = document.createElement('span');
    buttonText.textContent = NOTIFICATION.UNSYNC_PARENT_REPO;
    btn.appendChild(buttonText);
    btn.onclick = function() {
      unSyncHandler();
    }

    this.element.appendChild(btn);
  }
}

export class OpenRepoView {

  constructor(serializedState) {
    this.element = createRootElement();
    this.createView();
  }

  createView() {
    let textSpan = document.createElement('h3');
    textSpan.textContent = 'Create/Open a repo';
    this.element.appendChild(textSpan);
  }

}


export class daemonMessages {
  constructor(serializedState) {
    const text = serializedState.text;
    // Create root element
    this.element = document.createElement('button');
    this.element.setAttribute("id", DAEMON_MSG_TILE_ID);
    this.element.classList.add('codesync-status-bar', 'inline-block');
    // Add image
    const img = document.createElement('img');
    img.src = LOGO_URL;
    img.classList.add('img');
    this.element.appendChild(img);
    // Create icon
    const iconSpan = document.createElement('span');
    iconSpan.textContent = text

    switch (text) {
      case STATUS_BAR_MSGS.AUTHENTICATION_FAILED:
        // Button Click Handler
        this.element.onclick = function() {
          SignUpHandler();
        };
        break;
      case STATUS_BAR_MSGS.CONNECT_REPO:
        // Button Click Handler
        this.element.onclick = function() {
          SyncHandler();
        };
        break;
      default:
        break;
    }
    this.element.appendChild(iconSpan);
  }
}
