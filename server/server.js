var ShareDB = require('sharedb');
var WebSocket = require('ws');
var WebSocketStream = require('./WebSocketStream');
var otText = require('ot-text');

ShareDB.types.register(otText.type);

allConnections = [];

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
    // stream.on('data', function(chunk) {
    //   console.log(typeof chunk);
    //   console.log(chunk);
    // })

    ws.on('message', function(msg) {
      let data = JSON.parse(msg);
      console.log(data);
      if (data.a === 'meta') {
        if (data.type === 'init') {
          // a new session
          ws.createSession(data);
        } else {
          // meta changes: cursor position, text selection
          // and open/save/close file
          broadcastMsg(msg, ws);
        }
      } else {
        // OT
        stream.push(JSON.parse(msg));
      }
    });

    ws.on('close', (code, reason) => {
      let index = allConnections[ws.sessionId].indexOf(ws);
      if (index > -1) {
        allConnections[ws.sessionId].splice(index, 1);
        console.log('We just lost one connection: ' + ws.getId() + ' from ' + ws.sessionId);
        console.log('Now ' + ws.sessionId + ' has ' + allConnections[ws.sessionId].length + ' connection(s)');
        // TODO send closed client id to other clients
        let msg = {
          a: 'meta',
          type: 'close',
          clientId: ws.getId()
        };
        broadcastMsg(JSON.stringify(msg), ws);
      }
    });

    backend.listen(stream);
    console.log('Got one connection...');
  });

};

function broadcastMsg(msg, ws) {
  let sockets = allConnections[ws.sessionId];
  sockets.forEach( (socket) => {
    console.log(socket.getId());
    console.log(ws.getId());
    if (socket && (socket.getId() !== ws.getId())) {
      socket.send(msg);
    }
  });
}

WebSocket.prototype.createSession = function(data) {
  let sessionId = data.sessionId;
  if (typeof allConnections[sessionId] === 'undefined') {
    allConnections[sessionId] = [];
  }
  allConnections[sessionId].push(this);
  this.sessionId = sessionId;
  console.log('createSession: sessionId is: ' + sessionId);
  console.log('createSession: this.sessionId is: ' + this.sessionId);
};

WebSocket.prototype.getId = function() {
  return this.upgradeReq.headers['sec-websocket-key'];
};
