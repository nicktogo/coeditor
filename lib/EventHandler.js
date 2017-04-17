'use babel';

export default class EventHandler {
  constructor(socket, editor) {
    this.socket = socket;
    this.editor = editor;
    this.push = false;
  }

  listen(subscriptions) {

  }

  listenToEditorChanges(subscriptions) {
    let disposables = [];
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

    subscriptions.add(...disposables);
  }

  listenToBufferChanges(subscriptions) {
    subscriptions.add(this.editor.getBuffer().onDidChange((event) => {
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
  }

  sendSocketMsg(callback) {
    if (this.socket) {
      callback();
    }
  }


}
