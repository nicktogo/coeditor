'use babel'

import ShareDB from 'sharedb/lib/client';
import WebSocket from 'ws';
import EventHandler from './EventHandler';


export default class Router {
  constructor(config) {

    this.config = config;

    this.socket = new WebSocket('ws://' + config.serverAddress);

    this.socket.on('open', () => {
      let initData = {
        a         : 'meta',
        type      : 'init',
        sessionId : config.sessionId,
        clientId  : config.clientId
      };
      this.socket.send(JSON.stringify(initData));

      this.connection = new ShareDB.Connection(this.socket);

      this.eventHandlerMap = new Map();

      atom.notifications.addSuccess('Connected to: ' + this.socket.url);
    });

    this.socket.on('message', (msg) => {
      let data  = JSON.parse(msg);
      console.log('Socket receives: ' + data);

      if (data.a !== 'meta') { // an op msg for ShareDB
        return;
      }

      if (data.type === 'socketClose') {
        atom.notifications.addInfo(data.clientId + ' left.');
        for (let handler of this.eventHandlerMap.values()) {
          handler.resetMarker(data.clientId);
        }
      }

      let targetPath = data.targetPath;
      let targetHandler = eventHandlerMap.get(targetPath);
      if (typeof targetHandler !== 'undefined') {
        targetHandler.on(msg);
      }
    });

    this.socket.on('close', (code, reason) => {
      this.destroy();
    });
  }

  addHandler(path, editor) {
    let doc = this.connection.get(this.config.sessionId, path);
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
    this.socket.close();
    this.socket = null;
    atom.notifications.addSuccess("Disconnected");
  }
}
