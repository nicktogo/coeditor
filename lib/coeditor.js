'use babel';

import CoeditorView from './coeditor-view';
import { CompositeDisposable } from 'atom';
var firebase = require('firebase');

export default {

  coeditorView: null,
  modalPanel: null,
  subscriptions: null,

  buffer: null,
  dbRef: null,
  id: null,
  push: null,

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
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'coeditor:disconnect': () => this.destroy()
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

  destroy() {
    this.dbRef.off();
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
    this.dbRef = firebase.database().ref().child('event');
    this.push = true;
    this.listenToBufferChanges();
    this.listenToFirebaseChanges();
  },

  listenToBufferChanges() {
    this.buffer.onDidChange((event) => {
      if (!this.push) {
        return;
      }

      var changeType;
      var changeEvent = {};

      if (event['newText'].length === 0) {
        changeType = 'del';
        changeEvent['oldRange'] = event['oldRange'];
      } else if (event['oldRange'].containsRange(event['newRange'])) {
        changeType = 'rep';
        changeEvent['oldRange'] = event['oldRange'];
        changeEvent['newRange'] = event['newRange'];
        changeEvent['newText']  = event['newText'];
      } else {
        changeType = 'ins';
        changeEvent['newRange'] = event['newRange'];
        changeEvent['newText'] = event['newText'];
      }

      var firebaseData = {
        changeType: changeType,
        changeEvent: changeEvent
      };
      var newChild = this.dbRef.push();
      this.id = newChild.key;
      newChild.set(firebaseData);
    })
  },

  listenToFirebaseChanges() {
    this.dbRef.on('child_added', (snap) => {
      console.log(this.id);
      console.log(snap.key);
      console.log(this.id !== snap.key);
      if (this.id !== snap.key) {
        // TODO text manipulate
        var changeType = snap.val().changeType;
        var changeEvent = snap.val().changeEvent;
        this.doBufferChange( () => {
          switch (changeType) {
            case 'del':
              this.buffer.delete(changeEvent.oldRange);
              break;
            case 'rep':
              this.buffer.setTextInRange(changeEvent.oldRange, changeEvent.newText);
              break;
            case 'ins':
              this.buffer.insert(changeEvent.newRange.start, changeEvent.newText);
              break;
          }
        });
      } else {
        //atom.notifications.addSuccess("Received your own changes!");
      }
    });
  },

  doBufferChange(callback) {
    this.push = false;
    callback();
    this.push = true;
  }

};
