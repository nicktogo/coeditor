# coeditor package

A pair editing package for Atom.

![A screenshot of your package](https://f.cloud.github.com/assets/69169/2290250/c35d867a-a017-11e3-86be-cd7c5bf3ff9b.gif)

## Features
+ Non-conflict collaborative text editing
+ Text highlight synchronization
+ Collaborative awareness
+ Project sync
+ Grammar sync
+ Project's files saving and closing sync

## TODO
+ ~~Customized configuration (Server address, random session id or given by user)~~ DONE
+ ~~Broadcast disconnections to other living Atom clients~~ DONE
+ ~~Check socket status before using~~ DONE
+ ~~Broadcast server close to each Atom clients, and disconnect all clients~~ DONE
+ ~~Text selection background and cursor colors for different Atom clients ?~~ DONE  
+ Suggestions Synchronization NO API
+ ~~Settings view~~ DONE
+ ~~Working folder files synchronization~~ DONE
+ ~~File operations synchronization~~ DONE
  - ~~save -- DONE, but limited, don't work for new file which does not have path~~
  - ~~close~~
+ Heartbeat between client and server
+ Build cloud server

## Tentative
+ ~~Working folder files synchronization~~ MOVED TO TODO list
+ Server uses in-memory storage when running, so no file content will be stored in server when it is shutdown, might change to MongoDB

## Usage
_prerequisite: node.js (v>=6.10.1)_

+ Install dependencies
  - `cd coeditor`
  - `npm install`

+ Start Server
  - `npm start`

+ Run package in Atom
  - ~~open `coeditor` folder in Atom~~
  - ~~change `address` in `coeditor.js` and save~~
  - client can now set server address when toggling package
  - link package to Atom
    - `cd coeditor`
    - `apm link`
  - reload Atom, `ctrl + shift + F5`
  - open an existing or new file
  - toggle coeditor, `ctrl + shift + p` then type `toggle`, hit `coeditor: toggle`
  - input server address, session id and client id
  - check your server console
  - disconnect, `ctrl + shift + p` then type `disconnect`, hit `coeditor: disconnect`
