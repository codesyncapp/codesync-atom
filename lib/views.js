'use babel';

import { SignUpHandler, SyncHandler, unSyncHandler } from "./commands_handler";
import { LOGO_URL, NOTIFICATION, CONFIG_PATH, WEB_APP_URL, STATUS_BAR_MSGS, DAEMON_MSG_TILE_ID } from "./constants";
import { showLogIn, showConnectRepoView} from "./utils/setup_utils";
import { readYML } from "./utils/common";


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

export class buttonView {
    constructor(serializedState) {
      this.panel = null;
      // Create root element
      this.element = document.createElement('button');
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
        let view;

        const repoPath = atom.project.getPaths()[0];
        if (!repoPath) {
          const viewInstance = new OpenRepoView();
          view = atom.views.getView(viewInstance);
        }
        else {
          const showLogInView = showLogIn();
          const showConnectRepo = showConnectRepoView();

          if (showLogInView) {
            const loginViewInstance = new LoginView();
            view = atom.views.getView(loginViewInstance);
          }

          else if (!showLogInView && showConnectRepo) {
            const connectRepoViewInstance = new ShowConnectRepoView();
            view = atom.views.getView(connectRepoViewInstance);
          }

          else if (!showLogInView && !showConnectRepo) {
            const unsyncRepoViewInstance = new UnsyncRepoView();
            view = atom.views.getView(unsyncRepoViewInstance);
          }
        }

        if (!this.panel) {
          this.panel = atom.workspace.addRightPanel({
              item: view,
              visible: false
          });
        }

        const panels = atom.workspace.getRightPanels();
        panels.forEach((panel) => {
        if (panel.item.className === "codesync-view") {
            // Toggle value
            if (panel.isVisible()) {
              panel.hide();
            } else {
              panel.show();
            }
          }
        });
      };

    }
}


export class panelView {

  constructor(serializedState) { }

  getElement(obj) {
    if (!obj) { return this.element; }

    if ([NOTIFICATION.CONNECT_AFTER_JOIN, NOTIFICATION.CONNECT_REPO, NOTIFICATION.REPO_UNSYNCED].includes(obj.message)) {
      enableConnectRepoView();
    }

    if ([NOTIFICATION.REPO_SYNCED, NOTIFICATION.REPO_IN_SYNC].includes(obj.message)) {
      enableUnsyncRepoView();
    }

    return this.element;
  }

}

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
    link.href = "https://www.codesync.com/install";

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
    let textSpan = document.createElement('h3');
    textSpan.textContent = 'Repo is in sync with CodeSync';
    this.element.appendChild(textSpan);

    const repoPath = atom.project.getPaths()[0];
    if (!repoPath) { return; }
    const config = readYML(CONFIG_PATH);
    const repoId = config['repos'][repoPath].id;

    textSpan = document.createElement('h3');
    textSpan.textContent = 'Track it ';

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

const enableConnectRepoView = () => {
  const panels = atom.workspace.getRightPanels();
  panels.forEach((panel) => {
    if (panel.item.className === "codesync-view") {
      // Destroy old panel
      panel.destroy();
      // Show new panel
      const connectRepoViewInstance = new ShowConnectRepoView();
      const view = atom.views.getView(connectRepoViewInstance);
      atom.workspace.addRightPanel({
        item: view,
        visible: true
      });
    }
  })
}

const enableUnsyncRepoView = () => {
  const panels = atom.workspace.getRightPanels();
  panels.forEach((panel) => {
    if (panel.item.className === "codesync-view") {
      // Destroy old panel
      panel.destroy();
      // Show new panel
      const unsyncRepoViewInstance = new UnsyncRepoView();
      const view = atom.views.getView(unsyncRepoViewInstance);
      atom.workspace.addRightPanel({
        item: view,
        visible: true
      });
    }
  })
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
