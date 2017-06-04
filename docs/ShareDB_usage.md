## ShareDB 基本使用方法

[ShareDB](https://github.com/share/sharedb) 是一个整合了前后端的 OT 框架，可以很方便地自行搭建服务端和客户端。框架基于 Node.JS 实现。

### 服务端搭建步骤
+ 新建 Node 项目
  + `npm init -y`
+ 安装依赖
  ```bash
  npm install ShareDB@1.0.0-beta.7 \
  ot-text \
  ws \
  websocket-push-stream --save
  ```
+ 创建 server.js 文件  
  ```js
  var ShareDB = require('sharedb');
  var WebSocket = require('ws');
  var WebSocketStream = require('websocket-push-stream');
  var otText = require('ot-text');

  // ShareDB 可以支持多种 OT 类型，例如 JSON 文本，普通文本，富文本等
  // 具体文档可以查看 https://github.com/ottypes/docs
  // 这里使用普通文本类型 ot-text
  ShareDB.types.register(otText.type); // otText.type === 'text'
  
  // 获得 backend 对象后还可以为其添加一些中间件代码，从而可以控制操作转发的过程
  // 详细使用可以参考 ShareDB 的文档

  var backend = new ShareDB();

  // 监听 9090 端口
  var wss = new WebSocket.Server({port: 9090}, () => {
    console.log('WebSocket Server Created.');
  });

  // 监听新的客户端 WebSocket 链接，对新的链接进行封装，交给 ShareDB 处理
  wss.on('connection', function(ws) {

    // ShareDB 使用 stream 来与客户端实现通信，从而可以忽略底层的传输方式
    // 这里使用 WebSocket 作为底层的传输方式，保证实时数据传输
    let stream = new WebSocketStream(ws);

    // ShareDB 的前后端通信的数据以 JSON 格式传输
    // 服务端收到数据后，需要将数据从 JSON 转换为 Object
    // 并通过放入 stream 的缓存区 (push)，交给 ShareDB 处理
    ws.on('message', function(msg) {
      // 可以在这里对 msg 进行筛选，自定义的数据可以另行处理，不交给 ShareDB 处理
      stream.push(JSON.parse(msg));
    });

    // 使 ShareDB 监听新的链接
    backend.listen(stream);
  });
  ```
+ 启动 server  
  + `node server.js`

### 客户端搭建步骤
ShareDB 的客户端可以在浏览器网页和 Node 项目中使用。嵌入浏览器网页的用法可以参考 https://github.com/share/sharedb/tree/master/examples

#### 在 Node 项目中的使用
+ 安装依赖
  ```
  npm install ShareDB@1.0.0-beta.7 ws --save

  ```

+ 示例代码
  ```js
  var ShareDB = require('sharedb/lib/client');
  var WebSocket = require('ws');

  var socket = new WebSocket('ws://localhost:9090');
  socket.on('open', function() {

    // 通过 WebSocket 与 ShareDB 建立链接
    var connection = new ShareDB.Connection(socket);

    // 从 ShareDB 返回 collectionName 下的 documentName 文档
    // 同一个 collectionName 下可以有多个文档
    // 类似于 MongoDB 的存储方式
    var doc = connection.get('collectionName', 'documentName');

    // 从 ShareDB 服务器获取最新文档内容
    // 并指示 ShareDB 将后续对此文档的操作事件发送到此客户端
    doc.subscribe( function(error) {
      if (error) throw error;

      if (doc.type === null) {
        // 返回的 doc.type 为 null，则说明此文档还没有被创建
        // ShareDB 上不存在这个文档，所以这里做一次创建文档的操作
        // 第一个参数是文档内容，依据 OT 类型（第二个参数）的不同有不同的格式
        // 这里指定新的 doc 的 OT 类型为 'text'，所以文档内容为字符串
        this.doc.create(‘This is a new document’, 'text');
      } else {
        // doc.data 即为文档内容
        console.log(doc.data);
      }
    });

    // 监听事件，‘op’ 表示对文档有修改
    doc.on('op', function(op, source) {
      // source === true 表示是本客户端对 doc 的修改
      if (source) {
        return;
      }

      // op 是对文档的修改数据，对于不同的 OT 类型有不同的格式
      // 具体参考 https://github.com/ottypes/docs
      console.log(op);
    });

    // 通过 doc 提交文档改动
    // 在获得文档改动数据后，需要将改动数据转换成 OT 类型所对应的格式并通过 doc.submitOp 提交
    // 具体参考 https://github.com/ottypes/docs
    // 表示跳过 1 个字符，插入 a
    let op1 = [1, 'a'];
    // 提交改动到 ShareDB 服务端
    doc.submitOp(op1);

    // 表示跳过 2 个字符，删除 1 个长度的字符
    let op2 = [2, {d: 1}];
    // 提交改动到 ShareDB 服务端
    doc.submitOp(op2);

  });

  ```
