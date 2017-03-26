'use babel';

import CoeditorView from './coeditor-view';
import { CompositeDisposable } from 'atom';
var firebase = require('firebase');

export default {

  coeditorView: null,
  modalPanel: null,
  subscriptions: null,

  buffer: null,

  activate(state) {
    this.coeditorView = new CoeditorView(state.coeditorViewState);
    this.modalPanel = atom.workspace.addModalPanel({
      item: this.coeditorView.getElement(),
      visible: false
    });

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'coeditor:toggle': () => this.toggle()
    }));
  },

  deactivate() {
    this.modalPanel.destroy();
    this.subscriptions.dispose();
    this.coeditorView.destroy();
  },

  serialize() {
    return {
      coeditorViewState: this.coeditorView.serialize()
    };
  },

  toggle() {
    var config = {
      apiKey: "AIzaSyDtNFTDHUQrWeLd4GVrGoxtVvese07ikuE",
      authDomain: "co-atom.firebaseapp.com",
      databaseURL: "https://co-atom.firebaseio.com",
      storageBucket: "co-atom.appspot.com",
      messagingSenderId: "1039819959853"
    };
    firebase.initializeApp(config);
    this.buffer = atom.workspace.getActiveTextEditor().getBuffer();
    var dbRef = firebase.database().ref().child('text');
    dbRef.on('value', (snap) => {
      this.buffer.setText(snap.val());
    });
  }

};
