# coeditor package

A pair editing package for Atom.

![A screenshot of your package](https://f.cloud.github.com/assets/69169/2290250/c35d867a-a017-11e3-86be-cd7c5bf3ff9b.gif)

## Features
+ Non-conflict collaborative text editing
+ Text selection synchronization (Problematic)

## TODO
+ Customized configuration (Server address, random session id or given by user)
+ Broadcast disconnections to other living Atom clients
+ Check socket status before using
+ Text selection background and cursor colors for different Atom clients
+ File operations synchronization (save, close)
+ Build cloud server

## Tentative
+ Working folder files synchronization
+ Server uses in-memory storage when running, so no file content will be stored in server when it is shutdown, might change to MongoDB

## Usage
_prerequisites: node.js (v>=6.10.1)_

+ Install dependencies
  - `cd coeditor`
  - `npm install`

+ Start Server
  - change `address` in coeditor.js and save
  - `npm start`

+ Run package in Atom
  - link package to Atom
    - `cd coeditor`
    - `apm link`
  - reload Atom, `ctrl + shift + F5`
  - open existing or new file
  - toggle coeditor, `ctrl + shift + p` then type `toggle`, hit `coeditor: toggle`
  - check your Server console
  - (Buggy) disconnect, `ctrl + shift + p` then type `disconnect`, hit `coeditor: disconnect`
