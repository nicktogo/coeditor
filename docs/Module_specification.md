_本文档选取自论文第三节（架构设计），详细的代码实现请参考第四节（代码实现细节）_

# 软件整体架构
本软件采用 C/S 架构开发，Client 为 Atom 编辑器中的 Coeditor 插件，Server 为额外开发的程序，用于管理多个 Client 和同步编辑操作等事件。

# 客户端
客户端程序依赖于Atom编辑器，通过插件的形式提供实时协同纯文本编辑功能。当工作者通过Atom编辑器对文件做出操作以后，客户端程序都会从Atom编辑器捕获到相应的操作事件，并将这些操作事件发送给服务端程序，以同步到以他客户端程序上。下图为客户端架构图：
![client](/docs/client.png)

#### Controller
Controller是客户端程序的入口，当工作者在Atom编辑器中启用客户端程序（即插件）时，Controller会被触发从而完成客户端程序的初始化工作。除此之外，Controller还负责监听处理文件级事件，如活动文件切换、新打开文件等。生成相应的事件数据并通过Router发送出去。

#### Router
Router负责维护与服务端程序的WebSocket通信链接，对从服务端程序接收到的程序做二次筛选：活动文件切换、新打开文件等，将会被Router自行处理，做出相应的系统响应。其他操作事件，如光标移动，文件保存等，会被传递到对应的EventHandler处理。

#### WebSocket
用于保障服务端和客户端之间的实时数据传输。

#### EventHandler
每一个被打开的文本文件都有一个EventHandler与之相对应。EventHandler负责监听对应文件的内容编辑类操作事件和文件级操作事件（都是由Atom编辑器负责触发），例如：文本删除及插入、光标移动等，并生成对应的操作数据（JSON格式），通过ShareDB（Client）或Router将数据发送至服务端程序。另外，EventHandler也负责处理Router发送过来的文件操作事件（如光标移动，文件保存等），将数据解析，调用Atom编辑器的相关接口，将文件操作事件应用到文本上。

#### ShareDB（Client）
ShareDB需要Server与Client搭配使用。ShareDB（Client）代表一个文本文件。因此，如果客户端程序打开了多个文本文件时，会有多个ShareDB（Client）与之对应，而每个ShareDB（Client）都有一个EventHandler一一对应，ShareDB（Server）通过文本ID（本软件中使用文本文件的相对路径作为文本ID）区分不同的ShareDB（Client）。当ShareDB（Client）从EventHandler接收到文本内容编辑事件的相关数据（删除、插入）后，通过WebSocket将数据发送到ShareDB（Server），再经由ShareDB（Server）将数据转发至其他已连接客户端程序的ShareDB（Client）上。当ShareDB（Client）接收到文本内容编辑事件（删除、插入）的数据时，解析并处理后，交由EventHandler对文本内容作出相应的编辑（删除、插入）。

## 服务端
服务端程序一共划分为四个模块，分别是ShareDB，WebSocket，websocket-push-stream和broadcaster，ShareDB用于实现Operational Transformation算法，实现协同纯文本编辑，后三者用于支持服务端与客户端之间的实时通信。下图为服务端架构图：
![server.png](/docs/server.png)

####  ShareDB（Server）
ShareDB 是目前JavaScript上较为成熟的Operational Transformation算法的实现，同时ShareDB也提供了服务端和客户端整合的框架，可以方便地自行基于Node.JS平台搭建，并加入自定义功能。ShareDB（Server）内维护一个文本快照，保存最新的文本内容，当接收到客户端发送过来的内容编辑类操作（删除、插入）后，对相应的文本快照做出修改后，再将文本改动数据发送至其他所有客户端。

#### WebSocket
WebSocket用于保障服务端和客户端之间的实时数据传输（包括内容编辑类操作，如删除、插入等数据；文件级操作，如保存文本文件，活动文件切换等操作）。在服务端中负责监听特定端口的WebSocket客户端连接，并为新连接做初始化设置，以供服务端（ShareDB和broadcaster）使用。

#### websocket-push-stream
websocket-push-stream 是一个封装了WebSocket的双向通信流（stream），以WebSocket作为底层数据传输方式，在服务端接收到新的WebSocket连接后，将会为其初始化一个websocket-push-stream，专门提供给ShareDB消费。

#### broadcaster
broadcaster负责将客户端程序发送过来的数据做二次筛选，将与内容编辑类操作（删除，插入）传递给websocket-push-stream，进而由ShareDB处理；其他数据（包括客户端链接初始化和文件级操作）都会被暂存后再通过WebSocket转发至其余所有已连接的客户端程序。
