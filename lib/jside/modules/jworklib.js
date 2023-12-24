'use strict';

const   {workerData, BroadcastChannel} = require('worker_threads');
const   globals = require('../utils/constants').globals;
const   CmdNames = require('../utils/constants').CmdNames,
        WorkTable = require('../core/worktable'),
        jsys = require('../core/jamsys'),
        log = require('../utils/jerrlog');

let     funcRegistry = new Map(),
        condRegistry,
        cmdOpts,
        parent,
        taskIdCounter = 1;

let     worktbl = new WorkTable();
let     my = {};

let     enabled = false;

/*
 * This is the library included in the Worker thread at the App side.
 * We will have a similar library at the scheduler and the 'Lib' side as well.
 * For now, this library does the message interfacing and Application interfacing.
 * With multiple components (scheduler, lib, etc), we need some form of multiplexing.
 *
 * TODO: CLEANUP required. (1) AppChannel is unused. (2) We need to revise the jsys organization according to the new spec
 */
module.exports = {
    init,
	registerFuncs,
    registerConds,
    remoteExecNoRV,
    remoteExecRV,
    machExecNoRV,
    machExecRV,
    getJSys,
    getCmdOpts,
    notifyRedis
}



async function init(cback) {
    parent = workerData.port;
    return new Promise((resolve, reject) => {
        const appchannel = new BroadcastChannel(globals.ChannelName.APP_LIBRARY);
        parent.postMessage({cmd: "READY"});
        run(cback, () => {
            resolve(true);
        });
    });
}

/*
 * This is the run method in the worklib that starts the user code.
 */
function run(updatecb, resolvecb) {
    parent.on('message', function(ev) {
        let f;
        if (ev !== undefined) {
            ev.forEach((v)=> {
                switch (v.cmd) {
                    case CmdNames.REXEC:
                        if (enabled) {
                            f = funcRegistry.get(v.fn_name);
                            if (f.results)
                                executeRV(v, CmdNames.REXEC_RES, CmdNames.REXEC_ERR, CmdNames.REXEC_ACK, CmdNames.REXEC_NAK);
                            else
                                executeNoRV(v, CmdNames.REXEC_DONE, CmdNames.REXEC_ERR, CmdNames.REXEC_ACK, CmdNames.REXEC_NAK);
                        }
                    break;
                    case CmdNames.MEXEC:
                        if (enabled) {
                            f = funcRegistry.get(v.fn_name);
                            if (f.results)
                                executeRV(v, CmdNames.MEXEC_RES, CmdNames.MEXEC_ERR, CmdNames.MEXEC_ACK, CmdNames.MEXEC_NAK);
                            else
                                executeNoRV(v, CmdNames.MEXEC_DONE, CmdNames.MEXEC_ERR, CmdNames.MEXEC_ACK, CmdNames.MEXEC_NAK);
                        }
                    break;
                    case CmdNames.REXEC_ACK:
                        if (enabled) {
                            processAck(v.taskid, v.nodeid);
                            parent.postMessage({cmd: CmdNames.DONE});
                        }
                    break;
                    case CmdNames.MEXEC_ACK:
                        if (enabled) {
                            processAck(v.taskid, v.nodeid);
                            parent.postMessage({cmd: CmdNames.DONE});
                        }
                    break;
                    case CmdNames.REXEC_ERR:
                    case CmdNames.MEXEC_ERR:
                        if (enabled) {
                            processError(v.taskid, v.ecode);
                            parent.postMessage({cmd: CmdNames.DONE});
                        }
                    break;
                    case CmdNames.REXEC_RES:
                        if (enabled) {
                            processRes(v.taskid, v.nodeid, v.data);
                            parent.postMessage({cmd: CmdNames.DONE});
                        }
                    break;
                    case CmdNames.MEXEC_RES:
                        if (enabled) {
                            processRes(v.taskid, v.nodeid, v.data);
                            parent.postMessage({cmd: CmdNames.DONE});
                        }
                    break;
                    case CmdNames.SET_JSYS:
                        jsys.setRedis(v.data.redis.host, v.data.redis.port);
                        my.id = v.data.nodeid;
                        jsys.getId = function() { return my.id; }
                        jsys.setId = function(x) { my.id = x; }
                        jsys.machtype = v.data.type;
                        // Using jsys.type for user facing code, jsys.machtype is used internally
                        my.type = v.data.type;
                        jsys.getType = function() { return my.type; }
                        jsys.setType = function(x) { my.type = x; }
                        my.app = v.data.app;
                        jsys.getApp = function() { return my.app; }
                        jsys.setApp = function(x) { my.app = x; }
                        my.tags = v.data.tags;
                        jsys.getTags = function() { return my.tags; }
                        jsys.setTags = function(x) { my.tags = x; }
                        my.longitude = v.data.long;
                        jsys.getLongitude = function() { return my.longitude; }
                        jsys.setLongitude = function(x) { jsys.longitude = x; parent.postMessage({cmd: CmdNames.SET_CONF, opt: CmdNames.SET_LONG, data: x})}
                        my.latitude = v.data.lat;
                        jsys.getLatitude = function() { return my.latitude; }
                        jsys.setLatitude = function(x) { jsys.latitude = x; parent.postMessage({cmd: CmdNames.SET_CONF, opt: CmdNames.SET_LAT, data: x})}
                        jsys.hoistFog = hoistFog;
                        jsys.forceHoistFog = forceHoistFog;
                        enabled = true;
                        parent.postMessage({cmd: CmdNames.DONE});
                        if (resolvecb)
                            resolvecb();
                    break;
                    case CmdNames.REDIS_STATE:
                        switch (v.opt) {
                            case CmdNames.FOG_DATA_UP:
                            case CmdNames.CLOUD_DATA_UP:
                                updatecb({id: v.data.id, info: v.data.info, cmd:v.opt});
                            break;
                            case CmdNames.FOG_DATA_DOWN:
                            case CmdNames.CLOUD_DATA_DOWN:
                                updatecb({id: v.data.id, info: v.data.info, cmd:v.opt});
                            break;
                        }
                        parent.postMessage({cmd: CmdNames.DONE});
                    break;
                    default:
                }
            });
        }
    });
}

async function remoteExecNoRV(name, ct, argsig, ...params) {

    return new Promise(function(resolve, reject)
    {
        let taskid = Date.now() * 1000 + taskIdCounter++;
        let msg;
        if (ct)
            msg = {cmd: CmdNames.REXEC, fn_name: name, fn_argsig: argsig, params: params, taskid: taskid, results: false, type: my.type, edge: my.edge, latitude: my.latitude, longitude: my.longitude};
        else
            msg = {cmd: CmdNames.REXEC, fn_name: name, fn_argsig: argsig, params: params, taskid: taskid, results: false}
        let wentry = worktbl.createEntry(taskid, msg);
        let wchan = wentry.channel;
        wchan.on("gotAck", (tid)=> {
            worktbl.delete(tid);
            parent.postMessage({cmd: CmdNames.PURGE, taskid: tid, nodeid: jsys.id});
            resolve(true);
        });
        wchan.on("gotErr", (tid, elabel)=> {
            worktbl.delete(tid);
            parent.postMessage({cmd: CmdNames.PURGE, taskid: tid, nodeid: jsys.id});
            reject(elabel);
        });
        wchan.on("gotTimeout", (tid)=> {
            worktbl.delete(tid);
            parent.postMessage({cmd: CmdNames.PURGE, taskid: tid, nodeid: jsys.id});
            reject("JRUNTIME_TIMEOUT_ERROR");
        });
        parent.postMessage(msg);
    });
}

async function machExecNoRV(name, ct,  ...params) {

    return new Promise(function(resolve, reject)
    {
        let taskid = Date.now() * 1000 + taskIdCounter++;
        let msg;
        if (ct)
            msg = {cmd: CmdNames.MEXEC, fn_name: name, params: params, taskid: taskid, results: false, type: my.type, edge: my.edge, latitude: my.latitude, longitude: my.longitude};
        else
            msg = {cmd: CmdNames.MEXEC, fn_name: name, params: params, taskid: taskid, results: false};

        let wentry = worktbl.createEntry(taskid, msg);
        let wchan = wentry.channel;
        wchan.on("gotAck", (tid)=> {
            worktbl.delete(taskid);
            parent.postMessage({cmd: CmdNames.PURGE, taskid: tid, nodeid: jsys.id});
            resolve(true);
        });
        wchan.on("gotErr", (tid, elabel)=> {
            worktbl.delete(taskid);
            parent.postMessage({cmd: CmdNames.PURGE, taskid: tid, nodeid: jsys.id});
            reject(elabel);
        });
        wchan.on("gotTimeout", (tid)=> {
            worktbl.delete(taskid);
            parent.postMessage({cmd: CmdNames.PURGE, taskid: tid, nodeid: jsys.id});
            reject("JRUNTIME_TIMEOUT_ERROR");
        });
        parent.postMessage(msg);
    });
}

async function* machExecRV(name, ct, ...params) {
    let taskid = Date.now() * 1000 + taskIdCounter++;
    try {
        let msg;
        if (ct)
            msg = {cmd: CmdNames.MEXEC, fn_name: name, params: params, taskid: taskid, results: true, type: my.type, edge: my.edge, latitude: my.latitude, longitude: my.longitude};
        else
            msg = {cmd: CmdNames.MEXEC, fn_name: name, params: params, taskid: taskid, results: true};

        worktbl.createEntry(taskid, msg);
        parent.postMessage(msg);
        while (worktbl.pendingResults(taskid)) {
            let resp = await workTableResponse(taskid);
            switch (resp.type) {
                case 'gotRes':
                    for (const e of resp.data)
                        yield e;
                break;
                case 'gotErr':
                    yield Promise.reject(new Error(resp.data));
                break;
                case 'gotTimeout':
                    yield Promise.reject(new Error("JRUNTIME_TIMEOUT_ERROR"));
            }
        }
        return {cmd: CmdNames.DONE};
    } finally {
        worktbl.delete(taskid);
        parent.postMessage({cmd: CmdNames.PURGE, taskid: taskid, nodeid: jsys.id});
    }
}

async function* remoteExecRV(name, ct, argsig, ...params) {

    let taskid = Date.now() * 1000 + taskIdCounter++;
    try {
        let msg;
        if (ct)
            msg = {cmd: CmdNames.REXEC, fn_name: name, fn_argsig: argsig, params: params, taskid: taskid, results: true, type: my.type, edge: my.edge, latitude: my.latitude, longitude: my.longitude};
        else 
            msg = {cmd: CmdNames.REXEC, fn_name: name, fn_argsig: argsig, params: params, taskid: taskid, results: true};

        worktbl.createEntry(taskid, msg);
        parent.postMessage(msg);
        while (worktbl.pendingResults(taskid)) {
            let resp = await workTableResponse(taskid);
            switch (resp.type) {
                case 'gotRes':
                    for (const e of resp.data)
                        yield e;
                break;
                case 'gotErr':
                    yield Promise.reject(new Error(resp.data));
                break;
                case 'gotTimeout':
                    yield Promise.reject(new Error("JRUNTIME_TIMEOUT_ERROR"));
            }
        }
        return {cmd: CmdNames.DONE};
    } finally {
        worktbl.delete(taskid);
        parent.postMessage({cmd: CmdNames.PURGE, taskid: taskid, nodeid: jsys.id});
    }
}

async function workTableResponse(tid) {
    let wentry = worktbl.get(tid);
    let wchan = wentry.channel;
    return new Promise((resolve, reject)=> {
        wchan.on('gotRes', (tid, y)=> {
            if (y) {
                let values = worktbl.getvalues(tid);
                resolve({type: 'gotRes', data: values});
            }
        });
        wchan.on('gotErr', (tid, ecode)=> {
            resolve({type: 'gotErr', data: ecode});
        });
        wchan.on('gotTimeout', (tid)=> {
            resolve({type: 'gotTimeout'});
        });
    })
}

/*
 * Register all callbacks in the machbox.
 * These are functions registered by the application
 */
function registerFuncs(machbox) {
	machbox.forEach((val, key) => {
        registerCallback(key, val.func, val.arg_sig, val.sideeff, val.results, val.res_sig, val.reuse, val.cond);
    });
}

function registerConds(cds) {
    condRegistry = cds;
}

function registerCallback(name, fk, mask, se, res, res_sig, re, cnd) {
    if (name === "" || name === undefined) {
        log.error("Anonymous functions cannot be callbacks... request ignored");
        return;
    }
    if (funcRegistry.has(name)) {
        log.error("Duplicate registration: " + name + ".. overwritten.");
    }
    funcRegistry.set(name, {func: fk, arg_sig: mask, sideeff: se, results: res, res_sig: res_sig, reuse: re, cond: cnd});
}

function executeNoRV(v, doneMsg, errMsg, ackMsg, nackMsg) {
    var fentry = funcRegistry.get(v.fn_name);

    if (fentry !== undefined) {
        if ((checkCondition(fentry.cond, v) !== true))
            parent.postMessage({cmd: nackMsg, taskid: v.taskid, nodeid: v.nodeid, subcmd: CmdNames.COND_FALSE});
        else {
            parent.postMessage({cmd: ackMsg, taskid: v.taskid, nodeid: v.nodeid});
            fentry.func.apply(this, v.params);
            parent.postMessage({cmd: doneMsg, taskid: v.taskid, nodeid: v.nodeid});
        }
    } else
        parent.postMessage({cmd: errMsg, taskid: v.taskid, nodeid: v.nodeid, subcmd: CmdNames.FUNC_NOT_FOUND});
}

function executeRV(v, resMsg, errMsg, ackMsg, nackMsg) {
    let res;
    var fentry = funcRegistry.get(v.fn_name);

    if (fentry !== undefined) {
        if ((checkCondition(fentry.cond, v) !== true))
            parent.postMessage({cmd: nackMsg, taskid: v.taskid, nodeid: v.nodeid, subcmd: CmdNames.COND_FALSE});
        else {
            parent.postMessage({cmd: ackMsg, taskid: v.taskid, nodeid: v.nodeid});
            res = fentry.func.apply(this, v.params);
            res.then((r)=> {
                parent.postMessage({cmd: resMsg, data: r, res_sig: fentry.res_sig, taskid: v.taskid, nodeid: v.nodeid});
            });
        }
    } else
        parent.postMessage({cmd: errMsg, taskid: v.taskid, nodeid: v.nodeid, subcmd: CmdNames.FUNC_NOT_FOUND});
}

function processError(taskid, ecode) {
    let wentry = worktbl.get(taskid);
    if (wentry !== undefined)
        wentry.channel.emit("gotErr", taskid, ecode);
}

function processAck(taskid, nodeid) {
    let wentry = worktbl.get(taskid);
    if (wentry !== undefined) {
        worktbl.processAck(taskid, nodeid);
        wentry.channel.emit("gotAck", taskid);
    }
}

function processRes(taskid, nodeid, val) {
    let wentry = worktbl.get(taskid);
    if (wentry !== undefined) {
        let res = worktbl.processRes(taskid, nodeid, val);
        if (res && wentry.record.results === true)
            wentry.channel.emit("gotRes", taskid, res);
    }
}

function notifyRedis(host, port)
{
    parent.postMessage({cmd: CmdNames.SET_REDIS, data: {host: host, port: port}});
}

function hoistFog(ltime, k) {
    if (jsys.machtype === 'device')
        parent.postMessage({cmd: CmdNames.HOIST_FOG, opt: CmdNames.NORMAL, data: {lifetime: ltime, k: k}});
    else
        log.error("ERROR! Fog hoisting is not possible in a " + jsys.machtype);
}

function forceHoistFog(ltime, k) {
    if (jsys.machtype === 'device')
        parent.postMessage({cmd: CmdNames.HOIST_FOG, opt: CmdNames.FORCE, data: {lifetime: ltime, k: k}});
    else
        log.error("ERROR! Fog hoisting is not possible in a " + jsys.machtype);
}

function checkCondition(cond, v) {
    if (cond === "")
        return true;
    let cstr = condRegistry.get(cond);
    if (cstr === undefined)
        return false;
    let your = getYourStruct(v);
    return cstr(my, your);
}

// Return the your structure
function getYourStruct(v) {
    return {id: v.id, app: v.app, longitude: v.longitude, latitude: v.latitude, type: v.type, edge: v.edge};
}

function getJSys() {
    return jsys;
}

function getCmdOpts() {
    return cmdOpts;
}
