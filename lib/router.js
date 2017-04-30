'use babel';

import ShareDB from 'sharedb/lib/client';
import WebSocket from 'ws';
import EventHandler from './EventHandler';


export default class Router {
  constructor(sessionId, coeditor) {

    this.coeditor = coeditor;
    this.sessionId = sessionId;
    this.serverAddress = atom.config.get('coeditor.serverAddress');
    this.clientId = atom.config.get('coeditor.clientId');

    this.socket = new WebSocket('ws://' + this.serverAddress);

    this.socket.on('open', () => {
      let initData = {
        a         : 'meta',
        type      : 'init',
        sessionId : this.sessionId,
        clientId  : this.clientId
      };
      this.socket.send(JSON.stringify(initData));

      this.connection = new ShareDB.Connection(this.socket);
      console.log('Socket opened');

      this.eventHandlerMap = new Map();

      this.coeditor.onSocketOpened();
      atom.notifications.addSuccess('Connected to: ' + this.socket.url);
    });

    this.socket.on('message', (msg) => {
      let data  = JSON.parse(msg);
      console.log('Socket receives: ');
      console.log(data);

      if (data.a !== 'meta') { // an op msg for ShareDB
        return;
      }

      if (data.type === 'addTab') {
        atom.workspace.open(data.uri);
        return;
      }

      if (data.type === 'editorClosed') {
        let targetPath = data.path;
        atom.workspace.getPaneItems().forEach( (item) => {
          let itemPath = item.getPath();
          let paths = atom.project.relativizePath(itemPath);
          if (typeof itemPath !== 'undefined' && paths[1] === targetPath) {
            let pane = atom.workspace.paneForItem(item);
            pane.destroyItem(item);
            return;
          }
        });
      }

      if (data.type === 'socketClose') {
        atom.notifications.addInfo(data.clientId + ' left.');
        for (let handler of this.eventHandlerMap.values()) {
          handler.resetMarker(data.clientId);
        }
        return;
      }

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

  sendSocketMsg(msg) {
    if (this.socket) {
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
