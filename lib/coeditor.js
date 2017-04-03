'use babel';

import CoeditorView from './coeditor-view';
import { CompositeDisposable } from 'atom';
import ShareDB from 'sharedb/lib/client';
import otText from 'ot-text';
import WebSocket from 'ws';

ShareDB.types.register(otText.type);
console.log(ShareDB.types.map);

export default {
  subscriptions: null,

  socket: null,
  push: null,
  doc: null,
  buffer: null,

  activate(state) {
    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'coeditor:toggle': () => this.toggle()
    }));
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'coeditor:disconnect': () => this.deactivate()
    }));
  },

  deactivate() {
    // this.subscriptions.dispose();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      atom.notifications.addSuccess('Disconnected');
    } else {
      atom.notifications.addWarning("No active socket/connection");
    }
  },

  serialize() {
    return {
    };
  },

  toggle() {
    // TODO set address and portNumber
    var address = '192.168.1.175';
    var portNumber = 9090;
    this.socket = new WebSocket('ws://' + address + ':' + portNumber);
    this.socket.on('open', () => {
      atom.notifications.addSuccess('connected to: ' + this.socket.url);
      var connection = new ShareDB.Connection(this.socket);
      this.doc = connection.get('examples', 'test');
      this.buffer = atom.workspace.getActiveTextEditor().getBuffer();
      this.doc.subscribe( (error) => {
        if (error) throw error;
        if (this.doc.type === null) {
          this.doc.create(this.buffer.getText(), 'text');
        } else {
          let data = this.doc.data;
          console.log(data);
          this.doBufferChange( () => {
            this.buffer.setText(data);
          })
        }
      });
      this.push = true;
      this.listenToBufferChanges();
      this.listenToServerChanges();
    });
  },

  listenToBufferChanges() {
    this.buffer.onDidChange((event) => {
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

    })
  },

  doBufferChange(callback) {
    this.push = false;
    callback();
    this.push = true;
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
  }

};
