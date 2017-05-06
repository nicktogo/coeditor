'use babel';

import {Point, Range} from 'atom';

export default class EventHandler {
  constructor(doc, editor, path, router) {
    this.doc = doc;
    this.editor = editor;
    this.path = path;
    this.router = router;
    this.clientId = atom.config.get('coeditor.clientId');
    this.push = true;
    this.buffer = this.editor.getBuffer();
    this.indicatorMap = new Map();
    this.highlightMap = new Map();

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

      let data = {
        a: 'meta',
        type: 'addTab',
        uri: path // TextEditor's uri is it's absolute path, when sending data, we send relative path, then when we receive it, we will convert to absolute path
      };
      setTimeout( () => {
        this.router.sendSocketMsg(JSON.stringify(data));
      }, 0);
    });
  }

  listen() {
    // remote OT events
    this.doc.on('op', (op, source) => {
      if (source) {
        return;
      }
      console.log('on OP:');
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

    // local events
    let disposables = [];

    disposables.push(this.editor.onDidChangeGrammar( () => {

      let grammar = this.editor.getGrammar();
      let data = {
        a: 'meta',
        type: 'grammar',
        path: this.path,
        grammar: grammar.scopeName
      }

      setTimeout( () => {
        this.router.sendSocketMsg(JSON.stringify(data));
      }, 0);
    }));

    disposables.push(this.editor.onDidSave( (event) => {
      if (!this.push) {
        return;
      }

      let data = {
        a: 'meta',
        type: 'save',
        path: this.path
        // path: atom.project.relativizePath(event.path)[1]
      };

      setTimeout( () => {
        this.router.sendSocketMsg(JSON.stringify(data));
      }, 0);
    }));

    disposables.push(this.editor.onDidDestroy( () => {
      let data = {
        a: 'meta',
        type: 'editorClosed',
        path: this.path,
        clientId: this.clientId
      };

      setTimeout( () => {
        this.router.sendSocketMsg(JSON.stringify(data));
      }, 0);

    }));

    disposables.push(this.editor.onDidChangeSelectionRange( (event) => {
      if (!this.push) {
        return;
      }
      let data = {
        a: 'meta',
        type: 'highlight',
        path: this.path,
        newRange: event.newBufferRange,
        clientId: this.clientId
      };

      setTimeout( () => {
        this.router.sendSocketMsg(JSON.stringify(data));
      }, 0);
    }));

    disposables.push(this.editor.onDidChangeCursorPosition( (event) => {
      console.log('on did change cursor position');
      let data = {
        a: 'meta',
        type: 'cursorMoved',
        path: this.path,
        indicatorColor: atom.config.get('coeditor.indicatorBackgroundColor'),
        newPosition: event.newBufferPosition,
        clientId: this.clientId
      };

      setTimeout( () => {
        this.router.sendSocketMsg(JSON.stringify(data));
      }, 0);

      let position = this.buffer.characterIndexForPosition(event.newBufferPosition);
      let op = [position, {d: 0}];
      setTimeout( () => {
        this.doc.submitOp(op);
      }, 0);
    }));

    disposables.push(this.buffer.onDidChange((event) => {
      if (!this.push) {
        return;
      }
      console.log('on did change text');
      // remove text event
      if (event['oldText'].length !== 0) {
        let lineEnding = atom.config.get('coeditor.lineEnding');
        let oldText = lineEnding === 'CRLF' ?
                      event['oldText'].replace(/\r?\n/g, "\r\n") :
                      event['oldText'];
        console.log(oldText.length);
        let startPoint = event['oldRange'].start;
        let position = this.buffer.characterIndexForPosition(startPoint);
        let op = [position, {d: oldText.length}];
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

    return disposables;
  }

  on(msg) {
    let data = JSON.parse(msg);
    switch (data.type) {
      case 'grammar':
        this.onGrammar(data.grammar);
        break;
      case 'cursorMoved':
        // setTimeout( () => {
          this.onCursorMoved(data.newPosition, data.clientId, data.indicatorColor);
        // }, 1000);
        break;
      case 'highlight':
        this.onHighlight(data.newRange, data.clientId);
        break;
      case 'save':
        this.onSave(data.path);
        break;
      default:
    }
  }

  onGrammar(grammar) {
    this.editor.setGrammar(atom.grammars.grammarForScopeName(grammar));
  }

  onCursorMoved(positionObj, clientId, indicatorColor) {
    // type = overlay
    let overlayMarker = this.indicatorMap.resetMarker(clientId);

    overlayMarker = this.editor.markBufferPosition(Point.fromObject(positionObj), {
      'invalidate': 'never'
    });

    this.indicatorMap.set(clientId, overlayMarker);

    if (overlayMarker.isDestroyed()) {
      return;
    }
    this.editor.decorateMarker(overlayMarker, {
      type: 'overlay',
      position: 'head',
      item: this.getIndicator(clientId, indicatorColor)
    });
    console.log('onCursorMoved: ');
    console.log(positionObj);
  }

  getIndicator(text, indicatorColor) {
    let indicatorDiv = document.createElement('div');
    Object.assign(indicatorDiv.style, {
      transform: 'translate(0, -100%)',
      display: 'flex'
    });

    let cursorDiv = document.createElement('div');
    Object.assign(cursorDiv.style, {
      alignItems: 'stretch',
      borderLeft: '2px solid ' + indicatorColor
      // borderLeft: '2px solid rgba(31, 161, 93, 1)'
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
      backgroundColor: indicatorColor,
      paddingLeft: '1px',
      fontFamily: 'comic sans, comic sans ms, cursive, verdana, arial, sans-serif'
    }
    Object.assign(textDiv.style, style);
    indicatorDiv.appendChild(textDiv);

    return indicatorDiv;
  }

  onHighlight(rangeObj, clientId) {

    let marker = this.highlightMap.resetMarker(clientId);

    if (Point.fromObject(rangeObj.start).isEqual(Point.fromObject(rangeObj.end))) {
      return;
    }
    marker = this.editor.markBufferRange(Range.fromObject(rangeObj), {
      invalidate: 'never'
    });
    this.highlightMap.set(clientId, marker);
    this.editor.decorateMarker(marker, {
      type: 'highlight',
      class: 'selection'
    });
  }

  onSave(relativePath) {
    // atom.workspace.getActivePane().saveItem(atom.workspace.getActivePaneItem());
    this.push = false;
    console.log('on save: ');
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

  resetMarker(clientId) {
    this.highlightMap.resetMarker(clientId);
    this.indicatorMap.resetMarker(clientId);
  }

  destroy() {
    this.editor.getDefaultMarkerLayer().clear();
  }
}

Map.prototype.resetMarker = function(clientId) {
  let marker = this.get(clientId);
  if (typeof marker !== 'undefined') {
    marker.destroy();
  }
  return marker;
}
