'use strict';

const   {workerData, BroadcastChannel} = require('worker_threads');
const   globals = require('../utils/constants').globals;
const   CmdNames = require('../utils/constants').CmdNames,
        WorkTable = require('../core/worktable'),
        jsys = require('../core/jamsys');

let     funcRegistry = new Map(),
        condRegistry,
        cmdOpts,
        parent,
        taskIdCounter = 1;

let     worktbl = new WorkTable();

let     enabled = false;

/* 
 * This is the library included in the Worker thread at the App side.
 * We will have a similar library at the scheduler and the 'Lib' side as well.
 * For now, this library does the message interfacing and Application interfacing.
 * With multiple components (scheduler, lib, etc), we need some form of multiplexing.
 */
module.exports = {
    init,
	registerFuncs,
    registerConds,
    remoteExecNoRV,
    remoteExecRV,
    machExecNoRV,
    machExecRV,
    getjsys,
    getCmdOpts,
    setLoc,
    notifyRedis
}



async function init(cback) {
    parent = workerData.port;
    return new Promise((resolve, reject) => {
        const appchannel = new BroadcastChannel(globals.ChannelName.APP_LIBRARY);    
        parent.postMessage({cmd: "READY"});
        run(cback, ()=> {
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
                            processAck(v.taskid);
                            parent.postMessage({cmd: CmdNames.DONE});
                        }
                    break;
                    case CmdNames.MEXEC_ACK:
                        if (enabled) {
                            processAck(v.taskid);
                            parent.postMessage({cmd: CmdNames.DONE});
                        }
                    break;
                    case CmdNames.REXEC_ERR:
                    case CmdNames.MEXEC_ERR:
                        if (enabled) {
                            processError(v.taskid);
                            parent.postMessage({cmd: CmdNames.DONE});
                        }
                    break;
                    case CmdNames.REXEC_RES:
                        if (enabled) {
                            processRes(v.taskid, v.data);
                            parent.postMessage({cmd: CmdNames.DONE});
                        }
                    break;
                    case CmdNames.MEXEC_RES:
                        if (enabled) {
                            processRes(v.taskid, v.data);
                            parent.postMessage({cmd: CmdNames.DONE});
                        }
                    break;
                    case CmdNames.SET_JSYS:
                        jsys.setRedis(v.data.redis.host, v.data.redis.port);
                        jsys.id = v.data.nodeid;
                        jsys.machtype = v.data.type;
                        jsys.type = v.data.type;
                        jsys.app = v.data.app;
                        jsys.tags = v.data.tags;
                        jsys.setLong(v.data.long);
                        jsys.setLat(v.data.lat);
                        jsys.setLoc = setLoc;
                        jsys.hoistFog = hoistFog;
                        jsys.forceHoistFog = forceHoistFog;
                        enabled = true;
                        parent.postMessage({cmd: CmdNames.DONE});
                        if (resolvecb)
                            resolvecb();
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

async function remoteExecNoRV(name, argsig, ...params) {


    return new Promise(function(resolve, reject)
    {
        let taskid = Date.now() * 1000 + taskIdCounter++;
        console.log("Launched...... ", taskid);
        let msg = {cmd: CmdNames.REXEC, fn_name: name, argsig: argsig, params: params, taskid: taskid, results: false}
        let wentry = worktbl.createEntry(taskid, msg);
        let wchan = wentry.channel;
        wchan.on("gotAck", ()=> {
            worktbl.delete(taskid, 0);
            resolve(true);
        });
        wchan.on("gotErr", ()=> {
            worktbl.delete(taskid, 0);
            reject("network error");
        });
        wchan.on("gotTimeout", ()=> {
            worktbl.delete(taskid, 0);
            reject("timeout error");
        });
        parent.postMessage(msg);
    });
}

async function machExecNoRV(name, ...params) {

    return new Promise(function(resolve, reject)
    {
        let taskid = Date.now() * 1000 + taskIdCounter++;
        let msg = {cmd: CmdNames.MEXEC, fn_name: name, params: params, taskid: taskid, results: false}
        let wentry = worktbl.createEntry(taskid, msg);
        let wchan = wentry.channel;
        wchan.on("gotAck", ()=> {
            worktbl.delete(taskid, 0);
            resolve(true);
        });
        wchan.on("gotErr", ()=> {
            worktbl.delete(taskid, 0);
            reject("network error");
        });
        wchan.on("gotTimeout", ()=> {
            worktbl.delete(taskid, 0);
            reject("timeout error");
        });
        parent.postMessage(msg);
    });
}

async function machExecRV(name, ...params) {
    let status = {pending: 0, completed: 0, error:0};
    let values = [];

    let taskid = Date.now() * 1000 + taskIdCounter++;
    let msg = {cmd: CmdNames.MEXEC, fn_name: name, params: params, taskid: taskid, results: true}
    let wentry = worktbl.createEntry(taskid, msg);

    return new Promise((resolve, reject)=> {
        let wchan = wentry.channel;
        status.pending = wentry.pending;
        wchan.on('gotRes', (y)=> {
            status.completed++;
            console.log("---------------------- got res ---------", status);
            values.push(y);
            if (status.pending == status.completed) {
                worktbl.delete(taskid, status.completed);
                console.log("================================= closing========== ", taskid);
                resolve({ status: function() { return {completed: status.completed, error: status.error}; }, values: function() { return values;}});
            }
        });
        wchan.on('gotErr', ()=> {
            status.pending--;
            status.error++;
            if (status.pending == status.completed) {
                worktbl.delete(taskid, status.completed);
                resolve({ status: function() { return {completed: status.completed, error: status.error}; }, values: function() { return values;}});
            }
        });
        wchan.on('gotTimeout', ()=> {
            worktbl.delete(taskid, status.completed);
            resolve({ status: function() { return {completed: status.completed, error: status.error}; }, values: function() { return values;}});
        });
        parent.postMessage(msg);
    });
}

async function remoteExecRV(name, argsig, ...params) {
    let status = {pending: 0, completed: 0, error:0};
    let values = [];

    let taskid = Date.now() * 1000 + taskIdCounter++;
    let msg = {cmd: CmdNames.REXEC, fn_name: name, params: params, taskid: taskid, results: true}
    let wentry = worktbl.createEntry(taskid, msg);

    return new Promise((resolve, reject)=> {
        let wchan = wentry.channel;
        status.pending = wentry.pending;
        wchan.on('gotRes', (y)=> {
            status.completed++;
            console.log("----------------------------------- Got Res..", status);
            values.push(y);
            if (status.pending <= status.completed) {
                worktbl.gotoSubWaiting(taskid);
                resolve({ status: function() { return {completed: status.completed, error: status.error}; }, values: function() { return values;}});
            }
        });
        wchan.on('gotErr', ()=> {
            status.pending--;
            status.error++;
            console.log("~~~~~~~~~~~~~~~~~~~~Err ", taskid);
            if (status.pending == status.completed) {
                worktbl.delete(taskid);
                resolve({ status: function() { return {completed: status.completed, error: status.error}; }, values: function() { return values;}});
            }
        });
        wchan.on('gotTimeout', ()=> {
            console.log("~~~~~~~~~~~~~~~~~~~~", taskid);
            worktbl.delete(taskid);
            resolve({ status: function() { return {completed: status.completed, error: status.error}; }, values: function() { return values;}});
        });
        parent.postMessage(msg);
    });
}

/*
 * Register all callbacks in the machbox.
 * These are functions registered by the application
 */
function registerFuncs(machbox) {
	machbox.forEach((val, key) => {
        registerCallback(key, val.func, val.arg_sig, val.sideeff, val.results, val.reuse, val.cond);
    });
}

function registerConds(cds) {
    condRegistry = cds;
}

function registerCallback(name, fk, mask, se, res, re, cnd) {
    // FIXME: Change the following console.log()s to logger output. No console.log()s.
    if (name === "" || name === undefined) {
        console.log("Anonymous functions cannot be callbacks... request ignored");
        return;
    }
    if (funcRegistry.has(name)) {
        console.log("Duplicate registration: " + name + ".. overwritten.");
    }
    funcRegistry.set(name, {func: fk, arg_sig: mask, sideeff: se, results: res, reuse: re, cond: cnd});
}

function executeNoRV(v, doneMsg, errMsg, ackMsg, nackMsg) {
    var fentry = funcRegistry.get(v.fn_name);

    if (fentry !== undefined) {
        if ((checkCondition(fentry.cond) !== true)) 
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
        if ((checkCondition(fentry.cond) !== true)) 
            parent.postMessage({cmd: nackMsg, taskid: v.taskid, nodeid: v.nodeid, subcmd: CmdNames.COND_FALSE});
        else {
            parent.postMessage({cmd: ackMsg, taskid: v.taskid, nodeid: v.nodeid});
            res = fentry.func.apply(this, v.params);
            parent.postMessage({cmd: resMsg, data: res, taskid: v.taskid, nodeid: v.nodeid});
        }
    } else 
        parent.postMessage({cmd: errMsg, taskid: v.taskid, nodeid: v.nodeid, subcmd: CmdNames.FUNC_NOT_FOUND});
}

function processError(taskid) {
    let wentry = worktbl.get(taskid);
    if (wentry !== undefined) 
        wentry.channel.emit("gotErr");
}

function processAck(taskid) {
    let wentry = worktbl.get(taskid);
    worktbl.processAck(taskid);
    if (wentry !== undefined) {
        wentry.channel.emit("gotAck");
    }
}

function processRes(taskid, val) {
    let wentry = worktbl.get(taskid);
    worktbl.processRes(taskid);
    if (wentry !== undefined && wentry.record.results === true) 
        wentry.channel.emit("gotRes", val);
}


function setLoc(val) {
    jsys.long = val.long;
    jsys.lat = val.lat;
    parent.postMessage({cmd: CmdNames.SET_CONF, opt: CmdNames.SET_LOC, data: val});
}

function notifyRedis(host, port)
{
    parent.postMessage({cmd: CmdNames.SET_REDIS, data: {host: host, port: port}});
}

function hoistFog(ltime, k) {
    if (jsys.machtype === 'device')
        parent.postMessage({cmd: CmdNames.HOIST_FOG, opt: CmdNames.NORMAL, data: {lifetime: ltime, k: k}});
    else 
        console.log("ERROR! Fog hoisting is not possible in a " + jsys.machtype);
}

function forceHoistFog(ltime, k) {
    if (jsys.machtype === 'device')
        parent.postMessage({cmd: CmdNames.HOIST_FOG, opt: CmdNames.FORCE, data: {lifetime: ltime, k: k}});
    else 
        console.log("ERROR! Fog hoisting is not possible in a " + jsys.machtype);
}

function jcondEval(cstr) {
    var rval;
    if (cstr.length === 0)
        return false;
    if (cstr.includes("&&") && cstr.includes("||")) {
        console.log("WARNING! Unsupported jcond condition. Use either && or ||.");
        return false;
    }
    if (cstr.includes("&&")) {
        var comps = cstr.split("&&");
        rval = true;
        comps.forEach(function(cexpr) {
            try {
                if (eval(eval(cexpr)) === false)
                    rval = false;
            } catch(e) {
                return false;
            }
        })
        return rval;
    }
    else if (cstr.includes("||")) {
        var comps = cstr.split("||");
        rval = false;
        comps.forEach(function(cexpr) {
            try {
                if (eval(eval(cexpr)) === true)
                    rval = true;
            } catch(e) {
                rval = false;
            }
        })
        return rval;
    }
    else
    {
        try {
            return eval(eval(cstr));
        } catch(e) {
            return false;
        }
    }
}

function checkCondition(cond) {
    if (cond === "")
        return true;
    let cstr = condRegistry.get(cond);
    if (cstr === undefined)
        return false;
    let res = eval(cstr.source);
    return res;
}

function jcondContext(clvar) {
    if (clvar.includes('.')) {
        return eval(clvar);
    }
    return null;
}

function getjsys() {
    return jsys;
}

function getCmdOpts() {
    return cmdOpts;
}
