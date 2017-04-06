var util = require('util');
var Duplex = require('stream').Duplex;

function WebSocketStream(ws) {
  // Make work with or without 'new'
  if (!(this instanceof WebSocketStream)) {
    return new WebSocketStream(ws);
  }

  Duplex.call(this, {objectMode: true});
  this.ws = ws;
  var self = this;
  ws.on('close', function() {
    self.push(null); // end readable stream
    self.end(); // end writable stream

    self.emit('close');
    self.emit('end');
  });

  this.on('error', function() {
    ws.close();
  });
  this.on('end', function() {
    ws.close();
  });
};
util.inherits(WebSocketStream, Duplex);

WebSocketStream.prototype._read = function() {};
WebSocketStream.prototype._write = function(chunk, encoding, next) {
  this.ws.send(JSON.stringify(chunk));
  next();
};

module.exports = WebSocketStream;
