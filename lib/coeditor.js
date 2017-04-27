'use babel';

import CoeditorView from './coeditor-view';
import { CompositeDisposable, Range } from 'atom';
import ShareDB from 'sharedb/lib/client';
import otText from 'ot-text';
import WebSocket from 'ws';
import crypto from 'crypto';
import path from 'path';
import EventHandler from './EventHandler'

ShareDB.types.register(otText.type);
console.log(ShareDB.types.map);

export default {
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
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.editor.getDefaultMarkerLayer().clear();
      atom.notifications.addSuccess('Disconnected');
    } else {
      atom.notifications.addWarning("No active socket/connection");
    }
    this.initialized = false;
  },

  toggle() {
    this.initial({});
    let defaultConfig = {
      serverAddress : '192.168.1.175:9090',
      sessionId     : crypto.randomBytes(20).toString('hex'),
      clientId      : crypto.randomBytes(5).toString('hex')
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

    this.editor = atom.workspace.getActiveTextEditor();
    this.buffer = this.editor.getBuffer();
    // TODO set address and portNumber
    let address = config.serverAddress;
    this.socket = new WebSocket('ws://' + address);
    this.socket.on('open', () => {
      atom.notifications.addSuccess('connected to: ' + this.socket.url);
      var connection = new ShareDB.Connection(this.socket);
      this.doc = connection.get('examples', config.sessionId);
      this.doc.subscribe( (error) => {
        if (error) throw error;
        if (this.doc.type === null) {
          this.doc.create(this.buffer.getText(), 'text');
        } else {
          let data = this.doc.data;
          this.doBufferChange( () => {
            this.buffer.setText(data);
          })
        }
      });

      this.eventHandler = new EventHandler(
        this.socket,
        this.editor,
        this.doc,
        this.subscriptions,
        config.clientId
      );
      this.eventHandler.listen();

      let initData = {
        a         : 'meta',
        type      : 'init',
        sessionId : config.sessionId,
        clientId  : config.clientId
      };
      this.sendSocketMsg( () => {
        console.log('sending socket msg...');
        this.socket.send(JSON.stringify(initData));
      });
    });

    this.socket.on('close', (code, reason) => this.disconnect() );
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
