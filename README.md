# Coeditor

Yet Another Pair Programming Package for Atom.

## Demo
_Click to view high quality video on YouTube_

[![demo](demo.gif)](https://youtu.be/EOCw2HfRxZE)

## Features
+ Non-conflict collaborative text editing
+ Text highlight synchronization
+ Collaborative awareness
+ Project sync
+ File grammar sync
+ Active tab sync
+ Project's files saving and closing sync

## Known issue
+ If clients use different types for line ending (i.e. CRLF or LF) with each other, this package will cause files end up with inconsistent content.
**MAKE SURE ALL CLIENTS USE THE SAME TYPE FOR LINE ENDING AND SET TYPE IN PACKAGE'S SETTING VIEW! (EITHER CRLF OR LF WILL DO)**

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
+ ~~Tab sync~~
+ Heartbeat between client and server
+ Build cloud server
+ Write spec

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

+ Toggle package in Atom
  - ~~open `coeditor` folder in Atom~~
  - ~~change `address` in `coeditor.js` and save~~
  - ~~client can now set server address when toggling package~~
  - modify settings in the package's settings view firstly
    - server address
    - client id which will show in indicator
    - indicator background color
    - line ending
  - link package to Atom
    - `cd coeditor`
    - `apm link`
  - reload Atom, `ctrl + shift + F5`
  - open an existing or new file
  - toggle coeditor, `ctrl + shift + p` then type `toggle`, hit `coeditor: toggle`
  - input ~~server address,~~ session id ~~and client id~~
  - check your server console
  - disconnect, `ctrl + shift + p` then type `disconnect`, hit `coeditor: disconnect`
