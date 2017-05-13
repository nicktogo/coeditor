var ShareDB = require('sharedb');
var WebSocket = require('ws');
var WebSocketStream = require('websocket-push-stream');
var otText = require('ot-text');

ShareDB.types.register(otText.type);

allSessions = [];

var backend = new ShareDB();
backend.use('op', (request, callback) => {
  callback();
  setTimeout( () => {
    let ws = request.agent.stream.ws;
    let cursors = allSessions[ws.sessionId].cursors;
    if (typeof cursors !== 'undefined') {
      console.log('Broadcasting ' + ws.clientId + '\'s cursors');
      for (let path in cursors) {
        if (cursors.hasOwnProperty(path) && JSON.parse(cursors[path]).clientId === ws.clientId) {
          console.log(path);
          broadcastMsg(cursors[path], ws);
        }
      }
      cursors = {};
    }
  }, 0);
});
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
          // create or join a session
          ws.createOrJoinSession(data);
          ws.send(JSON.stringify(allSessions[ws.sessionId].tabs));
        } else {
          // tab changes: add or remove tab
          let logTabs = false;
          if (data.type === 'editorClosed') {
            let tabs = allSessions[ws.sessionId].tabs;
            let index = tabs.indexOf(data.path);
            if (index > -1) {
              tabs.splice(index, 1);
              console.log(data.path + ' removed.');
              logTabs = true;
            }
          } else if (data.type === 'addTab') {
            let tabs = allSessions[ws.sessionId].tabs;
            if (tabs.indexOf(data.uri) != -1) {
              return;
            }
            tabs.push(data.uri);
            logTabs = true;
            console.log(data.uri + ' added');
          } else if (data.type === 'cursorMoved') {
            let cursors = allSessions[ws.sessionId].cursors;
            cursors[data.path] = msg;
            return;
          }

          if (logTabs) {
            console.log('current tabs: ');
            console.log(allSessions[ws.sessionId].tabs);
            console.log('\n');
          }
          // other meta changes: cursor position, text selection
          // and open/save/close file
          broadcastMsg(msg, ws);
        }
      } else {
        // OT
        console.log(data);
        stream.push(JSON.parse(msg));
      }
    });

    ws.on('close', (code, reason) => {
      // socket client closed due to server closed, do not broadcast
      if (code === 1006) {
        return;
      }
      let index = allSessions[ws.sessionId].wss.indexOf(ws);
      if (index > -1) {
        allSessions[ws.sessionId].wss.splice(index, 1);
        console.log('We just lost one connection: ' + ws.clientId + ' from ' + ws.sessionId);
        console.log('Now ' + ws.sessionId + ' has ' + allSessions[ws.sessionId].wss.length + ' connection(s)');
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
  let sockets = allSessions[ws.sessionId].wss;
  sockets.forEach( (socket) => {
    if (socket.readyState === WebSocket.OPEN && (socket.getId() !== ws.getId())) {
      console.log('Broadcasting msg to ' + socket.clientId + '\n');
      console.log(msg);
      console.log('\n');
      setTimeout( () => {
        socket.send(msg);
      }, 0);
    }
  });
}

WebSocket.prototype.createOrJoinSession = function(data) {
  let sessionId = data.sessionId;
  let clientId  = data.clientId;
  this.sessionId = sessionId;
  this.clientId  = clientId;
  if (typeof allSessions[sessionId] === 'undefined') {
    let session = {};
    session.wss = [];
    session.tabs = [];
    session.cursors = {};
    allSessions[sessionId] = session;
  }
  allSessions[sessionId].wss.push(this);
  console.log('Session ' + sessionId + ' adds ' + clientId + '\n');
};

WebSocket.prototype.getId = function() {
  return this.upgradeReq.headers['sec-websocket-key'];
};
