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

export default {

  // config of this package
  config: {
    serverAddress: {
      type: 'string',
      default: '192.168.1.175:9090',
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
    },
    lineEnding: {
      type: 'string',
      default: 'CRLF',
      enum: ['CRLF', 'LF'],
      order: 4
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
    this.coeditorView.show(crypto.randomBytes(20).toString('hex'));
  },

  getConfigFromInput() {
    this.coeditorView.close();
    let sessionId = this.coeditorView.sessionIdEditor.getText();
    this.connect(sessionId);
  },

  connect(sessionId) {
    this.router = new Router(sessionId, this);
  },


  // FIXME when there is no active TextEditor, this method will fail
  initProjectPath() {
    let activeEditor = atom.workspace.getActiveTextEditor();
    this.projectPath = atom.project.relativizePath(activeEditor.getPath())[0];
  },

  onSocketOpened() {
    this.initProjectPath();

    this.subscriptions.add(atom.workspace.observeTextEditors( (editor) => {
      let editorPath = editor.getPath();
      let paths = atom.project.relativizePath(editorPath);
      if (this.projectPath === paths[0]) {
        let disposables = this.router.addHandler(paths[1], editor);
        this.subscriptions.add(...disposables);
      }
    }));

    this.subscriptions.add(atom.workspace.onDidChangeActivePaneItem( (item) => {
      if (!this.router.syncTab) {
        return;
      }
      if (!atom.workspace.isTextEditor(item)) {
        return;
      }
      let result = this.isProjectFile(item.getPath());
      if (result.isProjectFile) {
        let data = {
          a: 'meta',
          type: 'activePaneItemChanged',
          uri: result.relativePath
        };
        setTimeout( () => {
          this.router.sendSocketMsg(JSON.stringify(data));
        }, 0);
      }
    }));
  },

  isProjectFile(absolutePath) {
    let result = {
      isProjectFile: false
    };
    let paths = atom.project.relativizePath(absolutePath);
    if (this.projectPath === paths[0]) {
      result.isProjectFile = true;
      result.relativePath = paths[1];
      return result;
    }
    return result;
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
