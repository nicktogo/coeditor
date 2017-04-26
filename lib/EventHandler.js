'use babel';

import {Point, Range} from 'atom';

export default class EventHandler {
  constructor(socket, editor, doc, subscriptions, clientId) {
    this.socket = socket;
    this.editor = editor;
    this.doc = doc;
    this.subscriptions = subscriptions;
    this.clientId = clientId;
    this.push = true;
    this.buffer = editor.getBuffer();
    this.indicatorMap = new Map();
    this.highlightMap = new Map();
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
      let data = {
        a: 'meta',
        type: 'highlight',
        newRange: event.newBufferRange,
        clientId: this.clientId
      };

      setTimeout( () => {
        this.sendSocketMsg( () => {
          this.socket.send(JSON.stringify(data));
        });
      }, 0);
    }));

    disposables.push(this.editor.onDidChangeCursorPosition( (event) => {
      let data = {
        a: 'meta',
        type: 'cursorMoved',
        newPosition: event.newBufferPosition,
        clientId: this.clientId
      };
      setTimeout( () => {
        this.sendSocketMsg( () => {
          this.socket.send(JSON.stringify(data));
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
        case 'cursorMoved':
          // if (typeof this.marker !== 'undefined') {
          //   this.marker.destroy();
          // }
          this.onCursorMoved(data.newPosition, data.clientId);
          break;
        case 'highlight':
          // if (typeof this.overlayMarker !== 'undefined') {
          //   this.overlayMarker.destroy();
          // }
          this.onHighlight(data.newRange, data.clientId);
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

  onCursorMoved(positionObj, clientId) {
    // type = overlay
    let overlayMarker = this.indicatorMap.get(clientId);
    if (typeof overlayMarker !== 'undefined') {
      overlayMarker.destroy();
    }

    overlayMarker = this.editor.markBufferPosition(Point.fromObject(positionObj), {
      'invalidate': 'never'
    });

    this.indicatorMap.set(clientId, overlayMarker);

    this.editor.decorateMarker(overlayMarker, {
      type: 'overlay',
      position: 'head',
      item: this.getIndicator(clientId)
    });
  }

  getIndicator(text) {
    let indicatorDiv = document.createElement('div');
    Object.assign(indicatorDiv.style, {
      transform: 'translate(0, -100%)',
      display: 'flex'
    });

    let cursorDiv = document.createElement('div');
    Object.assign(cursorDiv.style, {
      alignItems: 'stretch',
      borderLeft: '2px solid rgba(31, 161, 93, 1)'
    });
    cursorDiv.animate([
      {opacity: '1'},
      {opacity: '0'}
    ], {
      duration: 300,
      iterations: 'Infinity',
      direction: 'alternate'
    });
    indicatorDiv.appendChild(cursorDiv);

    let textDiv = document.createElement('div');
    textDiv.textContent = text;
    let style = {
      alignItems: 'stretch',
      backgroundColor: 'rgba(31, 161, 93, 1)',
      paddingLeft: '1px',
      fontFamily: 'comic sans, comic sans ms, cursive, verdana, arial, sans-serif'
    }
    Object.assign(textDiv.style, style);
    indicatorDiv.appendChild(textDiv);

    return indicatorDiv;
  }

  onHighlight(rangeObj, clientId) {

    let marker = this.highlightMap.get(clientId);

    if (typeof marker !== 'undefined') {
      marker.destroy();
    }
    if (Point.fromObject(rangeObj.start).isEqual(Point.fromObject(rangeObj.end))) {
      return;
    }
    marker = this.editor.markBufferRange(Range.fromObject(rangeObj), {
      invalidate: 'never'
    });
    this.highlightMap.set(clientId, marker);
    this.editor.decorateMarker(marker, {
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
