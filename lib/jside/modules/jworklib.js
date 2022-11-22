'use strict';

const   CmdNames = require('../utils/constants').CmdNames,
        WorkTable = require('../core/worktable');

let     funcRegistry = new Map(),
        condRegistry,
        jsys,
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
module.exports = new function() {
    this.init = init;
	this.registerFuncs = registerFuncs;
    this.registerConds = registerConds;
    this.run = run;    
    this.remoteExecNoRV = remoteExecuteNoRV;
    this.remoteExecRV = remoteExecuteRV;
    this.machExecNoRV = machExecuteNoRV;
    this.machExecRV = machExecuteRV;
    this.getjsys = getjsys;
    this.getCmdOpts = getCmdOpts;
    this.setLong = setLong;
    this.setLat = setLat;
}

function init(port, bch) {
    parent = port;
}

/* 
 * This is the run method in the worklib that starts the user code. 
 */
function run(callback) {
    parent.on('message', function(ev) {
        let f;
        if (ev !== undefined) {
            ev.forEach((v)=> {
                switch (v.cmd) {
                    case CmdNames.REXEC:
                        if (enabled) {
                            f = funcRegistry.get(v.fn_name);
                            if (f.results)
                                executeRV(v, CmdNames.REXEC_RES, CmdNames.REXEC_ERR, CmdNames.REXEC_ACK);
                            else
                                executeNoRV(v, CmdNames.REXEC_DONE, CmdNames.REXEC_ERR, CmdNames.REXEC_ACK);
                        }
                    break;
                    case CmdNames.MEXEC:
                        if (enabled) {
                            f = funcRegistry.get(v.fn_name);
                            if (f.results)
                                executeRV(v, CmdNames.MEXEC_RES, CmdNames.MEXEC_ERR, CmdNames.MEXEC_ACK);
                            else
                                executeNoRV(v, CmdNames.MEXEC_DONE, CmdNames.MEXEC_ERR, CmdNames.MEXEC_ACK);
                        }
                    break;
                    case CmdNames.REXEC_ACK:
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
                    case CmdNames.MEXEC_RES:
                        if (enabled) {
                            processResults(v.taskid, v.data);
                            parent.postMessage({cmd: CmdNames.DONE});
                        }
                    break;
                    case CmdNames.SET_JSYS:
                        jsys = v.data;
                        enabled = true;
                        parent.postMessage({cmd: CmdNames.DONE});
                        if (callback)
                            callback();
                    default:
                }
            });
        }
    });  
}

function remoteExecuteNoRV(name, argsig, params) {

    return new Promise(function(resolve, reject)
    {
        let taskid = Date.now() * 1000 + taskIdCounter++;
        let msg = {cmd: CmdNames.REXEC, fn_name: name, argsig: argsig, params: params, taskid: taskid, results: false}
        parent.postMessage(msg);
        worktbl.insert(taskid, msg, function (res) {
            worktbl.delete(taskid);
            if (res)
                resolve(true);
            else
                reject("network error");
        });
    });
}

function machExecuteNoRV(name, params) {

    return new Promise(function(resolve, reject)
    {
        let taskid = Date.now() * 1000 + taskIdCounter++;
        let msg = {cmd: CmdNames.MEXEC, fn_name: name, params: params, taskid: taskid, results: false}
        parent.postMessage(msg);
        worktbl.insert(taskid, msg, function(res) {
            worktbl.delete(taskid);
            if (res)
                resolve(true);
            else
                reject("network error");
        });
    });
}

function machExecuteRV(name, params) {

    return new Promise(function(resolve, reject)
    {
        let taskid = Date.now() * 1000 + taskIdCounter++;
        let msg = {cmd: CmdNames.MEXEC, fn_name: name, params: params, taskid: taskid, results: true}
        parent.postMessage(msg);
        worktbl.insert(taskid, msg, function(ack, res, val) {
            if (ack === false) {
                worktbl.delete(taskid);
                reject("network error");
            } else if (res !== undefined) {
                worktbl.delete(taskid);
                if (res === false) {
                    reject("network error");
                } else 
                    resolve(val);
            }
        });
    });
}

function remoteExecuteRV(name, argsig, params) {

    return new Promise(function(resolve, reject)
    {
        let taskid = Date.now() * 1000 + taskIdCounter++;
        let msg = {cmd: CmdNames.REXEC, fn_name: name, argsig: argsig, params: params, taskid: taskid, results: true}
        parent.postMessage(msg);
        worktbl.insert(taskid, msg, function(ack, res, val) {
            if (ack === false) {
                worktbl.delete(taskid);
                reject("network error");
            } else if (res !== undefined) {
                worktbl.delete(taskid);
                if (res === false)
                    reject("network error");
                else 
                    resolve(val);
            }
        });
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

function executeNoRV(v, doneMsg, errMsg, ackMsg) {
    var fentry = funcRegistry.get(v.fn_name);

    if (fentry !== undefined) {
        if ((checkCondition(fentry.cond) !== true)) 
            parent.postMessage({cmd: errMsg, taskid: v.taskid, nodeid: v.nodeid, subcmd: CmdNames.COND_FALSE});
        else {
            parent.postMessage({cmd: ackMsg, taskid: v.taskid, nodeid: v.nodeid});
            fentry.func.apply(this, v.params);
            parent.postMessage({cmd: doneMsg, taskid: v.taskid, nodeid: v.nodeid});
        }
    } else
        parent.postMessage({cmd: errMsg, taskid: v.taskid, nodeid: v.nodeid, subcmd: CmdNames.FUNC_NOT_FOUND});
}

function executeRV(v, resMsg, errMsg, ackMsg) {
    let res;
    var fentry = funcRegistry.get(v.fn_name);

    if (fentry !== undefined) {
        if ((checkCondition(fentry.cond) !== true)) 
            parent.postMessage({cmd: errMsg, taskid: v.taskid, subcmd: CmdNames.COND_FALSE});
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
    if (wentry !== undefined) {
        if (wentry.record.results === false)
            wentry.callback(false);
        else 
            wentry.callback(false, undefined, undefined);
    }
}

function processAck(taskid) {
    let wentry = worktbl.get(taskid);
    if (wentry !== undefined) {
        if (wentry.record.results === false)
            wentry.callback(true);
        else 
            wentry.callback(true, undefined, undefined);
    }

}

function processResults(taskid, val) {
    let wentry = worktbl.get(taskid);
    if (wentry !== undefined) {
        if (wentry.record.results !== false)
            wentry.callback(true, true, val);
    }
}


function setLong(val) {
    parent.postMessage({cmd: 'SET-CONF', opt: 'SET-LONG', data: val});
}

function setLat(val) {
    parent.postMessage({cmd: 'SET-CONF', opt: 'SET-LAT', data: val});
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
