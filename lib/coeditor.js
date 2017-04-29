'use babel';

import CoeditorView from './coeditor-view';
import { CompositeDisposable, Range } from 'atom';
import ShareDB from 'sharedb/lib/client';
import otText from 'ot-text';
import WebSocket from 'ws';
import crypto from 'crypto';
import path from 'path';
import EventHandler from './EventHandler';
import Router from './router';

ShareDB.types.register(otText.type);
console.log(ShareDB.types.map);

export default {

  config: {
    serverAddress: {
      type: 'string',
      default: '192.168.1.175:8080',
      order: 1
    },
    clientId: {
      type: 'string',
      default: crypto.randomBytes(5).toString('hex'),
      order: 2
    },
    indicatorBackgroundColor: {
      type: 'color',
      default: 'rgba(31, 161, 93, 1)',
      order: 3
    }
  },

  coeditorView: null,
  subscriptions: null,

  socket: null,
  push: null,
  doc: null,
  editor: null,
  buffer: null,
  marker: null,

  initialized: null,

  activate(state) {
    this.initial(state);
  },

  deactivate() {
    this.disconnect();
  },

  serialize() {
    return {
    };
  },

  initial(state) {
    if (this.initialized) {
      return;
    }

    this.coeditorView = new CoeditorView(state.viewState);
    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    atom.commands.add('atom-workspace', {
      'coeditor:toggle': () => this.toggle()
    });
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'coeditor:disconnect': () => this.disconnect()
    }));
    this.subscriptions.add(atom.commands.add(this.coeditorView.element, {
      'core:confirm': () => this.getConfigFromInput(),
      'core:cancel': () => this.coeditorView.close()
    }));
    this.initialized = true;
  },

  disconnect() {
    if (!this.initialized) {
      return;
    }
    this.coeditorView.destroy();
    this.subscriptions.dispose();
    this.router.destroy();
    this.initialized = false;
  },

  toggle() {
    this.initial({});
    let defaultConfig = {
      serverAddress : atom.config.get('coeditor.serverAddress'),
      sessionId     : crypto.randomBytes(20).toString('hex'),
      clientId      : atom.config.get('coeditor.clientId')
    };
    this.coeditorView.setConfig(defaultConfig);
    this.coeditorView.show();
  },

  getConfigFromInput() {
    this.coeditorView.close();
    console.log('server address: ' + this.coeditorView.serverEditor.getText());
    console.log('session id: ' + this.coeditorView.sessionIdEditor.getText());
    console.log('client id: ' + this.coeditorView.clientIdEditor.getText());
    let config = {
      serverAddress : this.coeditorView.serverEditor.getText(),
      sessionId     : this.coeditorView.sessionIdEditor.getText(),
      clientId      : this.coeditorView.clientIdEditor.getText()
    };
    this.connect(config);
  },

  connect(config) {
    this.router = new Router(config, this);
  },

  initProjectPath() {
    let activeEditor = atom.workspace.getActiveTextEditor();
    this.projectPath = atom.project.relativizePath(activeEditor.getPath())[0];
    console.log('root project path is: ' + this.projectPath);
  },

  onSocketOpened() {
    this.initProjectPath();

    this.subscriptions.add(atom.workspace.observeTextEditors( (editor) => {
      let editorPath = editor.getPath();
      let paths = atom.project.relativizePath(editorPath);
      if (this.projectPath === paths[0]) {
        console.log("valid editor's path is " + paths[1]);
        let disposables = this.router.addHandler(paths[1], editor);
        this.subscriptions.add(...disposables);
      }
    }));
  },

  doBufferChange(callback) {
    this.push = false;
    callback();
    this.push = true;
  },

  sendSocketMsg(callback) {
    if (this.socket) {
      callback();
    }
  }
};
