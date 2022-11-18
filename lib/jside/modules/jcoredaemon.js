'use strict';

const   CmdNames = require('../utils/constants').CmdNames,
        INQ_States = require('../utils/constants').INQ_States,
        Timeouts = require('../utils/constants').globals.Timeouts,
        ErrorCodes = require('../utils/constants').globals.ErrorCodes;

/* 
 * Daemon running in the J node. This has two main functions: (1) to process
 * the replies to requests that has been sent out and (2) to process 
 * execution requests arriving at the J node 
 * (i.e., C2J calls or other J2J calls). For instance, 
 * REXEC command sent from a J node to a C node is expected to get an ACK back.
 * The JCoreDaemon is responsible for processing that ACK response. would 
 * give an ACK. We need to process the ACK. Similarly, we can receive requests
 * for executing functions
 * The daemon uses two tables: OutTaskTable and InTaskQueue. 
 */
class JCoreDaemon {
    constructor(jc) {
        if (JCoreDaemon.this)
            return JCoreDaemon.this;
        JCoreDaemon.this = this;
        this.jcore = jc;
    }

    async replyProcessor(msg) {
        /*
         * Process the different type of replies
         */
        console.log("~~~~~~~~~~~~~~~~~ in reply processor ------ ", msg);
        switch (msg['cmd']) {
            case CmdNames.REXEC_ACK:
            case CmdNames.MEXEC_ACK:
                console.log("Calling process Ack ..");
                this.jcore.otasktbl.processAck(msg.nodeid + msg.taskid, msg.args[0]);
            break;
            case CmdNames.REXEC_ERR:
            case CmdNames.MEXEC_ERR:
                console.log("Calling process Err ..");
                this.jcore.otasktbl.processErr(msg.nodeid + msg.taskid, msg.args[0]);
                break;
            case CmdNames.REXEC_RES:
            case CmdNames.MEXEC_RES:
                this.jcore.otasktbl.processRes(msg.nodeid + msg.taskid, msg.args[0]);
            break;
        }
    }

    /* 
     * requestProcessor is responsible for processing incoming execution requests. We have requests from 
     * workers and controllers. We expect all requests to yield a result - which is not true! If the task is 
     * not yielding a result - the result would be undefined. 
     */
    async requestProcessor(msg) {
        let fentry = this.jcore.findFunctionEntry(msg.fn_name);
        if (fentry === undefined)
            return undefined;
        let id = msg.nodeid + msg.taskid;
        let res = undefined;
        switch (msg['cmd']) {
            case CmdNames.REXEC:
                res = __INQ_lookup(this.jcore.itaskq, id);
                if (res !== undefined) {
                    // there is an instance of the same task - that is either completed or running
                    if (res.state === INQ_States.COMPLETED)
                        return {cmd: CmdNames.REXEC_RES, nodeid:msg.nodeid, taskid: msg.taskid, args: [res.results]};
                    else {
                        let x = {cmd: CmdNames.REXEC_ACK, nodeid:msg.nodeid, taskid: msg.taskid, args: [Timeouts.REXEC_ACK_TIMEOUT]};
                        return x;
                    }
                } else {
                    __INQ_put(this.jcore.itaskq, id, INQ_States.STARTING, undefined, undefined);
                    if (fentry.sideeffect === false) {
                        let presults = predictCache.get(msg.fn_name, msg.params);
                        if (presults !== undefined && Math.random() < presults.prob)
                            return {cmd: CmdNames.REXEC_ACK_RES, nodeid:msg.nodeid, taskid: msg.taskid, args: [presults.res]};
                    }
                    // We did not find in the cache or the function has side effect. In either case,
                    // we need to a new execution. So, we launch the execution and wait for the ACK from
                    // the worker. 
                    await this.new_execution(msg, id);
                    // we are returning after ACK.. not completion.. the worker sent ACk at start of task
                    return {cmd: CmdNames.REXEC_ACK, nodeid:msg.nodeid, taskid: msg.taskid, fn_argsig: "i", args: [Timeouts.REXEC_ACK_TIMEOUT]};
                }
            break;
            case CmdNames.GET_REXEC_RES:
                res = __INQ_lookup(this.jcore.itaskq, id);
                if (res !== undefined) {
                    // there is an instance of the same task - that is either completed or running
                    if (res.state === INQ_States.COMPLETED)
                        return {cmd: CmdNames.REXEC_RES, nodeid:msg.nodeid, taskid: msg.taskid, res: res.results};
                    else {
                        let cres = await this.check_execution(msg, id);
                        predictCache.put(msg.fn_name, msg.params, true, cres);
                        return {cmd: CmdNames.REXEC_RES, nodeid:msg.nodeid, taskid: msg.taskid, res: cres};
                    }
                } else 
                    return {cmd: CmdNames.REXEC_ERR, nodeid:msg.nodeid, taskid: msg.taskid, code: ErrorCodes.NoTask};
            break;
            case CmdNames.MEXEC:
                res = __INQ_lookup(this.jcore.itaskq, id);
                if (res !== undefined) {
                    // there is an instance of the same task - that is either completed or running
                    if (res.state === INQ_States.COMPLETED)
                        return {cmd: CmdNames.MEXEC_RES, nodeid:msg.nodeid, taskid: msg.taskid, data: res.results};
                    else 
                        return {cmd: CmdNames.MEXEC_ACK, nodeid:msg.nodeid, taskid: msg.taskid, data: Timeouts.REXEC_ACK_TIMEOUT};
                } else { 
                    __INQ_put(this.jcore.itaskq, id, INQ_States.STARTING, undefined, undefined);
                    /*
                    if (fentry.sideeffect === false) {
                        let presults = predictCache.get(msg.fn_name, msg.params);
                        if (presults !== undefined && Math.random() < presults.prob)
                            return {cmd: CmdNames.MEXEC_ACK_RES, nodeid:msg.nodeid, taskid: msg.taskid, res: presults.res};
                    }
                    */
                    // We did not find in the cache or the function has side effect. In either case,
                    // we need to a new execution. So, we launch the execution and wait for the ACK from
                    // the worker. 
                    await this.new_execution(msg, id);
                    // we are returning after ACK.. not completion.. the worker thread sent ACk at start of task
                    return {cmd: CmdNames.MEXEC_ACK, nodeid:msg.nodeid, taskid: msg.taskid, data: Timeouts.REXEC_ACK_TIMEOUT};
                }
            break;
            case CmdNames.GET_MEXEC_RES:
                res = __INQ_lookup(this.jcore.itaskq, id);
                if (res !== undefined) {
                    // there is an instance of the same task - that is either completed or running
                    if (res.state === INQ_States.COMPLETED)
                        return {cmd: CmdNames.MEXEC_RES, nodeid:msg.nodeid, taskid: msg.taskid, res: res.results};
                    else {
                        let cres = await this.check_execution(msg, id);
                        predictCache.put(msg.fn_name, msg.params, true, cres);
                        return {cmd: CmdNames.MEXEC_RES, nodeid:msg.nodeid, taskid: msg.taskid, res: cres};
                    }
                } else 
                    return {cmd: CmdNames.MEXEC_ERR, nodeid:msg.nodeid, taskid: msg.taskid, code: ErrorCodes.NoTask};
            break;
        }
        return undefined;
    }

    async new_execution(msg, id) {
        let that = this;
        this.jcore.enqueueJob({cmd: msg.cmd, fn_name: msg.fn_name, nodeid: msg.nodeid, taskid: msg.taskid, params: msg.args});
        return new Promise((resolve, reject)=> {
            __INQ_put(that.jcore.itaskq, id, INQ_States.STARTED, undefined, function(state, res) {
                if (state === INQ_States.STARTED) 
                    resolve(res);
            });
        });
    }

    async checkExecResults(id) {
        let that = this;
        let res = __INQ_lookup(this.jcore.itaskq, id);
        if (res.state === INQ_States.COMPLETED)
            return res.results;
        else {
            return new Promise((resolve, reject)=> {
                __INQ_updatecb(that.jcore.itaskq, id, function(state, res) {
                    if (state === INQ_States.COMPLETED) 
                        resolve(res);
                });
            });
        }
    }
}

function __INQ_lookup(inq, id) {
    let ientry = inq.get(id);
    if (ientry === undefined) 
        return undefined;
    else
        return {state: ientry.state, results: ientry.results};
}

function __INQ_put(inq, id, state, result, cb) {
    let ientry = {state: state, results: result, callback: cb};
    inq.set(id, ientry);
}

function __INQ_updatecb(inq, id, cb) {
    let ientry = inq.get(id);
    ientry.callback = cb;
    inq.set(id, ientry);
}


module.exports = JCoreDaemon;
