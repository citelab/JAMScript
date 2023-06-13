const deasync = require('deasync');
const {Worker, MessagePort, MessageChannel, isMainThread, parentPort, threadId} = require('worker_threads');

