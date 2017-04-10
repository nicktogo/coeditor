'use babel';

import {TextEditor} from 'atom';

export default class CoeditorView {

  constructor(serializedState) {
    // Create root element
    this.element = document.createElement('div');
    this.element.classList.add('coeditor');

    // Create server input element
    let serverLabel = document.createElement('div');
    serverLabel.textContent = 'Server address';
    this.element.appendChild(serverLabel);
    this.serverEditor = new TextEditor({mini: true});
    this.element.appendChild(this.serverEditor.element);

    // Create sessionId input element
    let sessionIdLabel = document.createElement('div');
    sessionIdLabel.textContent = 'Session Id';
    this.element.appendChild(sessionIdLabel);
    this.sessionIdEditor = new TextEditor({mini: true});
    this.element.appendChild(this.sessionIdEditor.element);

    atom.commands.add(this.element, {
      'core:confirm': () => console.log(this.serverEditor.getText()),
      'core:cancel': () => this.close()
    });
    atom.commands.add('atom-workspace', {
      'coeditor:show': () => this.attach()
    });
  }

  setConfig(config) {
    this.config = config;
  }

  close() {
    if (this.panel.isVisible()) {
      this.panel.hide();
    }
  }

  attach() {
    this.panel = atom.workspace.addModalPanel({item: this, visible: false});
    this.panel.show();
    this.serverEditor.element.focus();
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
