const path = require('path');

const TIMESTAMP = false;

const OFF = 0;
const ERROR = 1;
const WARN = 2;
const INFO = 3;
const DEBUG = 4;
const TRACE = 5;

const level = DEBUG;

function error(fileName, processType, ...messages) {
    if (level >= ERROR) {
        log(fileName, processType, messages);
    }
}

function warn(fileName, processType, ...messages) {
    if (level >= WARN) {
        log(fileName, processType, messages);
    }
}

function info(fileName, processType, ...messages) {
    if (level >= INFO) {
        log(fileName, processType, messages);
    }
}

function debug(fileName, processType, ...messages) {
    if (level >= DEBUG) {
        log(fileName, processType, messages);
    }
}

function trace(fileName, processType, ...messages) {
    if (level >= TRACE) {
        log(fileName, processType, messages);
    }
}

function log(fileName, processType, messages) {
    fileName = path.basename(fileName);
    if (TIMESTAMP) {
        const timestamp = process.hrtime.bigint().toString();
        console.log(timestamp, `[${processType}:${fileName}]`, ...messages);
    } else {
        console.log(`[${processType}:${fileName}]`, ...messages);
    }
}

exports.error = error;
exports.warn = warn;
exports.info = info;
exports.debug = debug;
exports.trace = trace;
