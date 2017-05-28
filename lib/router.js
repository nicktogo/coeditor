'use babel';

import ShareDB from 'sharedb/lib/client';
import WebSocket from 'ws';
import EventHandler from './EventHandler';
import path from 'path';

/*
* The Router is the central processor, it is responsible for several things:
* 1. managing WebSocket, which is used to communicate with server.
* 2. managing EventHandlers, which correspond to Atom's TextEditor.
* 3. responsing to system-wide events.
* 4. dispatch editor's events to EventHandlers.
*/

export default class Router {
  constructor(sessionId, coeditor) {

    this.coeditor = coeditor;
    this.sessionId = sessionId;
    this.serverAddress = atom.config.get('coeditor.serverAddress');
    this.clientId = atom.config.get('coeditor.clientId');

    // filepath -> EventHandler
    this.eventHandlerMap = new Map();

    // TODO move sync tab option to config
    this.syncTab = true;

    this.socket = new WebSocket('ws://' + this.serverAddress);

    this.socket.on('open', () => {
      let initData = {
        a         : 'meta',
        type      : 'init',
        sessionId : this.sessionId,
        clientId  : this.clientId
      };
      this.sendSocketMsg(JSON.stringify(initData));

      this.connection = new ShareDB.Connection(this.socket);

      this.coeditor.onSocketOpened();
      atom.notifications.addSuccess('Connected to: ' + this.socket.url);
    });

    this.socket.on('message', (msg) => {
      let data  = JSON.parse(msg);

      // an op msg for ShareDB, do not process it
      if (data.a !== 'meta') {
        return;
      }

      // system-wide event
      // TODO move to coeditor.js
      if (data.type === 'activePaneItemChanged') {
        this.syncTab = false;
        let targetUri = path.join(this.coeditor.projectPath, data.uri);
        atom.workspace.open(targetUri).then( () => {
          this.syncTab = true;
        });
        return;
      }

      // system-wide event
      // TODO move to coeditor.js
      if (data.type === 'editorClosed') {
        let targetPath = data.path;
        atom.workspace.getPaneItems().forEach( (item) => {
          let itemPath = item.getPath();
          let paths = atom.project.relativizePath(itemPath);
          paths[1] = this.coeditor.normalizePath(paths[1]);
          if (typeof itemPath !== 'undefined' && paths[1] === targetPath) {
            let pane = atom.workspace.paneForItem(item);
            pane.destroyItem(item);
            return;
          }
        });
        return;
      }

      // system-wide event
      if (data.type === 'socketClose') {
        atom.notifications.addInfo(data.clientId + ' left.');
        for (let handler of this.eventHandlerMap.values()) {
          handler.resetMarker(data.clientId);
        }
        return;
      }

      // editor event
      let targetPath = data.path;
      let targetHandler = this.eventHandlerMap.get(targetPath);
      if (typeof targetHandler !== 'undefined') {
        targetHandler.on(msg);
      }
    });

    this.socket.on('close', (code, reason) => {
      this.coeditor.disconnect();
    });
  }

  addHandler(path, editor) {
    let doc = this.connection.get(this.sessionId, path);
    let handler = new EventHandler(doc, editor, path, this);
    this.eventHandlerMap.set(path, handler);
    return handler.listen();
  }

  // send socket msg via Router's WebSocket
  sendSocketMsg(msg) {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(msg);
    }
  }

  destroy() {
    for (let handler of this.eventHandlerMap.values()) {
      handler.destroy();
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      atom.notifications.addSuccess("Disconnected");
    } else {
      atom.notifications.addWarning("No active socket/connection");
    }
  }
}
