'use babel';

import {Point, Range} from 'atom';

export default class EventHandler {
  constructor(socket, editor, doc, subscriptions) {
    this.socket = socket;
    this.editor = editor;
    this.doc = doc;
    this.subscriptions = subscriptions;
    this.push = true;
    this.buffer = editor.getBuffer();
  }

  listen() {
    let disposables = [];

    // local events
    disposables.push(this.editor.onDidSave( (event) => {
      if (!this.push) {
        return;
      }
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
    }));

    disposables.push(this.editor.onDidChangeSelectionRange( (event) => {
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
    }));

    disposables.push(this.buffer.onDidChange((event) => {
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
    }));
    this.subscriptions.add(...disposables);

    // remote events
    this.listenToServerChanges();
  }

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
      for (var i = 0; i < op.length; i++) {
        var component = op[i];
        switch (typeof component) {
          case 'number':
            pos += component;
            break;
          case 'string':
            this.onInsert(pos, component);
            pos += component.length;
            break;
          case 'object':
            this.onRemove(pos, component.d);
            break;
          default:
            break;
        }
      }
    });
  }

  onSelect(rangeObj) {
    if (typeof this.marker !== 'undefined') {
      this.marker.destroy();
    }
    if (Point.fromObject(rangeObj.start).isEqual(Point.fromObject(rangeObj.end))) {
      return;
    }
    this.marker = this.editor.markBufferRange(Range.fromObject(rangeObj), {
      invalidate: 'never'
    });
    this.editor.decorateMarker(this.marker, {
      type: 'highlight',
      class: 'coeditor-selection'
    });
  }

  onSave(relativePath) {
    // atom.workspace.getActivePane().saveItem(atom.workspace.getActivePaneItem());
    this.push = false;
    console.log(atom.project.getPaths());
    if (typeof this.editor.getPath() !== 'undefined') {
      this.editor.save();
    }
    this.push = true;
    // if (typeof this.editor.getPath() !== 'undefined') {
    //   this.editor.save();
    // } else {
    //   let absolutePath = path.join(atom.project.getPaths()[0], relativePath);
    //   this.editor.saveAs(absolutePath);
    // }
  }

  onClose() {
    atom.workspace.getActivePaneItem().destroy();
  }

  onSocketClose(clientId) {
    atom.notifications.addInfo(clientId + ' left.');
  }

  onInsert(position, text) {
    this.doBufferChange( () => {
      let from = this.buffer.positionForCharacterIndex(position);
      this.buffer.insert(from, text);
    })
  }

  onRemove(position, length) {
    this.doBufferChange( () => {
      let from = this.buffer.positionForCharacterIndex(position);
      let to = this.buffer.positionForCharacterIndex(position + length);
      this.buffer.delete([from.toArray(), to.toArray()]);
    })
  }

  doBufferChange(callback) {
    this.push = false;
    callback();
    this.push = true;
  }

  sendSocketMsg(callback) {
    if (this.socket) {
      callback();
    }
  }
}
