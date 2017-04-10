'use babel';

export default class CoeditorView {

  constructor(serializedState) {
    // Create root element
    this.element = document.createElement('div');
    this.element.classList.add('coeditor');

    // Create message element
    // const message = document.createElement('div');
    // message.textContent = 'The Coeditor package is Alive! It\'s ALIVE!';
    // message.classList.add('message');
    // this.element.appendChild(message);

    // Create input element
    let label = document.createElement('label');

    let addressInput = document.createElement('input');
    addressInput.type = 'text';
    addressInput.className = 'input-text';
    addressInput.value = '';

    label.appendChild(addressInput);
    this.element.appendChild(label);
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
