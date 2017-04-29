'use babel';

import {TextEditor} from 'atom';

export default class CoeditorView {

  constructor(serializedState) {
    // Create root element
    this.element = document.createElement('div');
    this.element.classList.add('coeditor');

    // Create sessionId input element
    let sessionIdLabel = document.createElement('div');
    sessionIdLabel.textContent = 'Session Id';
    this.element.appendChild(sessionIdLabel);
    this.sessionIdEditor = new TextEditor({mini: true});
    this.element.appendChild(this.sessionIdEditor.element);
  }

  close() {
    if (this.panel.isVisible()) {
      this.panel.hide();
    }
  }

  show(sessionId) {
    if (!this.panel) {
      this.panel = atom.workspace.addModalPanel({item: this, visible: false});
    }
    this.sessionIdEditor.setText(sessionId);
    this.panel.show();
    this.sessionIdEditor.element.getModel().selectAll();
    this.sessionIdEditor.element.focus();
  }

  // Returns an object that can be retrieved when package is activated
  serialize() {}

  // Tear down any state and detach
  destroy() {
    this.element.remove();
  }

  getElement() {
    return this.element;
  }

}
