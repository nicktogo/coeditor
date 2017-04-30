var ShareDB = require('sharedb');
var WebSocket = require('ws');
var WebSocketStream = require('./WebSocketStream');
var otText = require('ot-text');

ShareDB.types.register(otText.type);

allConnections = [];
tabs = []; // array of opening tabs, denoted by uri

var backend = new ShareDB();
startServer();

function startServer() {
  // Create a WebSocket Server
  // and connect any incoming WebSocket connection to ShareDB
  var wss = new WebSocket.Server({port: 9090}, () => {
    console.log('WebSocket Server Created.');
  });
  wss.on('connection', function(ws) {
    var stream = new WebSocketStream(ws);

    ws.on('message', function(msg) {
      let data = JSON.parse(msg);
      if (data.a === 'meta') {
        console.log('Received meta data:');
        console.log(data);
        console.log('\n');
        if (data.type === 'init') {
          // a new session
          ws.createSession(data);
          ws.send(JSON.stringify(tabs));
        } else {
          // tab changes: add or remove tab
          let logTabs = false;
          if (data.type === 'editorClosed') {
            let index = tabs.indexOf(data.path);
            if (index > -1) {
              tabs.splice(index, 1);
            }
            logTabs = true;
            console.log(data.path + ' removed.');
          } else if (data.type === 'addTab') {
            if (tabs.indexOf(data.uri) != -1) {
              return;
            }
            tabs.push(data.uri);
            logTabs = true;
            console.log(data.uri + ' added');
          }

          if (logTabs) {
            console.log('current tabs: ');
            console.log(tabs);
            console.log('\n');
          }
          // other meta changes: cursor position, text selection
          // and open/save/close file
          broadcastMsg(msg, ws);
        }
      } else {
        // OT
        console.log('Received OT data:');
        console.log('Action is ' + data.a);
        console.log('Collection is ' + data.c);
        console.log('Document is ' + data.d);
        console.log('\n');  stream.push(JSON.parse(msg));
      }
    });

    ws.on('close', (code, reason) => {
      // socket client closed due to server closed, do not broadcast
      if (code === 1006) {
        return;
      }
      let index = allConnections[ws.sessionId].indexOf(ws);
      if (index > -1) {
        allConnections[ws.sessionId].splice(index, 1);
        console.log('We just lost one connection: ' + ws.clientId + ' from ' + ws.sessionId);
        console.log('Now ' + ws.sessionId + ' has ' + allConnections[ws.sessionId].length + ' connection(s)');
        console.log('\n');
        let msg = {
          a: 'meta',
          type: 'socketClose',
          clientId: ws.clientId
        };
        broadcastMsg(JSON.stringify(msg), ws);
      }
    });

    backend.listen(stream);
    console.log('Got one connection...\n');
  });

  process.on('SIGINT', () => {
    wss.close( () => {
      process.exit();
    });
  });

};

function broadcastMsg(msg, ws) {
  let sockets = allConnections[ws.sessionId];
  sockets.forEach( (socket) => {
    if (socket && (socket.getId() !== ws.getId())) {
      console.log('Broadcasting msg to ' + socket.clientId + '\n');
      socket.send(msg);
    }
  });
}

WebSocket.prototype.createSession = function(data) {
  let sessionId = data.sessionId;
  let clientId  = data.clientId;
  if (typeof allConnections[sessionId] === 'undefined') {
    allConnections[sessionId] = [];
  }
  allConnections[sessionId].push(this);
  this.sessionId = sessionId;
  this.clientId  = clientId;
  console.log('Session ' + sessionId + ' adds ' + clientId + '\n');
};

WebSocket.prototype.getId = function() {
  return this.upgradeReq.headers['sec-websocket-key'];
};
