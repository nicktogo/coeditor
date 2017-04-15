'use babel';

import CoeditorView from './coeditor-view';
import { CompositeDisposable, Range } from 'atom';
import ShareDB from 'sharedb/lib/client';
import otText from 'ot-text';
import WebSocket from 'ws';
import crypto from 'crypto';
import path from 'path';

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

      this.push = true;
      this.subscriptions.add(this.listenToBufferChanges());
      this.subscriptions.add(this.listenToEditorChanges());
      this.listenToServerChanges();

      // TODO: get sessionId from user input
      let initData = {
        a         : 'meta',
        type      : 'init',
        sessionId : config.sessionId,
        clientId  : config.clientId
      };
      this.sendSocketMsg( () => {
        this.socket.send(JSON.stringify(initData));
      });
    });
  },

  listenToEditorChanges() {
    this.subscriptions.add(
      this.editor.onDidSave( (event) => {
        let saveData = {
          a: 'meta',
          type: 'save',
          path: atom.project.relativizePath(event.path)[1]
        };
        setTimeout( () => {
          this.sendSocketMsg( () => {
            this.socket.send(JSON.stringify(saveData));
          });
        }, 0);
      })
    );

    return this.editor.onDidChangeSelectionRange( (event) => {
      let selectionData = {
        a: 'meta',
        type: 'select',
        selectRange: event.newBufferRange
      };
      setTimeout( () => {
        this.sendSocketMsg( () => {
          this.socket.send(JSON.stringify(selectionData));
        });
      }, 0);
    });
  },

  listenToBufferChanges() {
    return this.buffer.onDidChange((event) => {
      if (!this.push) {
        return;
      }
      // remove text event
      if (event['oldText'].length !== 0) {
        let startPoint = event['oldRange'].start;
        let position = this.buffer.characterIndexForPosition(startPoint);
        let op = [position, {d: event['oldText'].length}];
        this.doc.submitOp(op);
      }

      // insert text event
      if (event['newText'].length !== 0) {
        let startPoint = event['newRange'].start;
        let position = this.buffer.characterIndexForPosition(startPoint);
        let op = [position, event['newText']];
        this.doc.submitOp(op);
      }

    })
  },

  listenToServerChanges() {
    this.socket.on('message', (msg) => {
      let data = JSON.parse(msg);
      console.log(data);
      if (data.a !== 'meta') {
        return;
      }
      switch (data.type) {
        case 'select':
          this.onSelect(data.selectRange);
          break;
        case 'save':
          this.onSave(data.path);
          break;
        case 'close':
          this.onClose();
          break;
        case 'socketClose':
          this.onSocketClose(data.clientId);
          break;
        default:
      }
    });
    this.doc.on('op', (op, source) => {
      if (source) {
        console.log('Got your own changes, I am not doing anything...');
        return;
      }
      console.log('changing...');
      console.log(op);

      var pos = 0;
      var spos = 0;
      for (var i = 0; i < op.length; i++) {
        var component = op[i];
        switch (typeof component) {
          case 'number':
            pos += component;
            spos += component;
            break;
          case 'string':
            this.onInsert(pos, component);
            pos += component.length;
            break;
          case 'object':
            this.onRemove(pos, component.d);
            spos += component.d;
            break;
          default:
        }
      }
    });
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
  },

  onInsert(position, text) {
    this.doBufferChange( () => {
      let from = this.buffer.positionForCharacterIndex(position);
      this.buffer.insert(from, text);
    })
  },

  onRemove(position, length) {
    this.doBufferChange( () => {
      let from = this.buffer.positionForCharacterIndex(position);
      let to = this.buffer.positionForCharacterIndex(position + length);
      this.buffer.delete([from.toArray(), to.toArray()]);
    })
  },

  onSelect(range) {
    console.log('onSelect: begin');
    if (this.marker !== null) {
      this.marker.destroy();
    }
    this.marker = this.editor.markBufferRange(Range.fromObject(range), {
      invalidate: 'never'
    });
    this.editor.decorateMarker(this.marker, {
      type: 'highlight',
      class: 'coeditor-selection'
    });
    console.log('onSelect: end');
  },

  onSave(relativePath) {
    // atom.workspace.getActivePane().saveItem(atom.workspace.getActivePaneItem());
    console.log(atom.project.getPaths());
    if (typeof this.editor.getPath() !== 'undefined') {
      this.editor.save();
    } else {
      let absolutePath = path.join(atom.project.getPaths(), relativePath);
      this.editor.saveAs(absolutePath);
    }
  },

  onClose() {
    atom.workspace.getActivePaneItem().destroy();
  },

  onSocketClose(clientId) {
    atom.notifications.addInfo(clientId + ' left.');
  }

};
