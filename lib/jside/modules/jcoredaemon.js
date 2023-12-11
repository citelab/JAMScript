'use strict';

const   CmdNames = require('../utils/constants').CmdNames,
        INQ_States = require('../utils/constants').INQ_States,
        Timeouts = require('../utils/constants').globals.Timeouts,
        ErrorCodes = require('../utils/constants').globals.ErrorCodes,
        JAMP = require('../utils/jamprotocol');

/*
 * Daemon running in the J node. This has two main functions: (1) to process
 * the replies to requests that has been sent out and (2) to process
 * execution requests arriving at the J node
 *
 * In (1), we are processing replies for requests that are launched by this
 * J node. However, the requests would have been emitted by the JCoreClient.
 * So, we need to check the OutTaskTable and update the pending status of the
 * request.
 *
 * In (2), we have a new request coming in - arriving for the first time at the
 * J node. The request can come from the worker (REXEC) or another controller (MEXEC).
 * We process the request and pass the execution to the thread (worker thread) that
 * is handling the actual execution. For the incoming requests, we use use InTaskQueue
 * to keep track of the execution status.
 *
 */

let rcounter = 0;
let icounter = 0;
setInterval(()=> {
    console.log("Received REXEC calls: ", rcounter);
    console.log("Intable size: ", icounter);
    rcounter = 0;
}, 1000);

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
        switch (msg['cmd']) {
            case CmdNames.REXEC_ACK:
            case CmdNames.MEXEC_ACK:
                this.jcore.otasktbl.processAck(msg.oldid + msg.taskid, msg.nodeid, msg.args[0]);
            break;
            case CmdNames.REXEC_ERR:
            case CmdNames.MEXEC_ERR:
                this.jcore.otasktbl.processErr(msg.oldid + msg.taskid, msg.nodeid, msg.args[0]);
                break;
            case CmdNames.REXEC_NAK:
            case CmdNames.MEXEC_NAK:
                this.jcore.otasktbl.processNak(msg.oldid + msg.taskid, msg.nodeid, msg.args[0]);
                break;
            case CmdNames.REXEC_RES:
            case CmdNames.MEXEC_RES:
                this.jcore.otasktbl.processRes(msg.oldid + msg.taskid, msg.nodeid, msg.args[0]);
            break;
        }
    }

    /*
     * requestProcessor is responsible for processing incoming execution requests. We have requests from
     * workers and controllers. We expect all requests to yield a result - which is not true! If the task is
     * not yielding a result - the result would be undefined.
     */
    async *requestProcessor(msg) {
        let res;

        switch (msg['cmd']) {
            case CmdNames.REXEC:
                rcounter++;
              //  res = this.jcore.intasktbl.findExact(msg.taskid);
                if (res !== undefined) {
                    // there is an instance of the same task - that is either completed or running
                    if (res.state === INQ_States.COMPLETED)
                        yield JAMP.createRemotePutRes(msg.taskid, this.jcore.jamsys.id, msg.nodeid, res.res_sig, res.results);
                    else
                        yield JAMP.createRemotePutAck(msg.taskid, this.jcore.jamsys.id, msg.nodeid, Timeouts.REXEC_ACK_TIMEOUT);
                } else {
                    let pres = this.jcore.intasktbl.findApprox(msg.taskid, msg.fn_name, msg.params);
                    if (pres && Math.random() < pres.prob)
                        yield JAMP.createRemotePutRes(msg.taskid, this.jcore.jamsys.id, msg.nodeid, pres.res_sig, pres.results)

                    // We did not find in the cache or the function has side effect. In either case,
                    // we need to a new execution. So, we launch the execution and wait for the ACK from
                    // the worker.
                    res = await this.newExecution(msg);
                    if (res !== undefined && res.cmd === CmdNames.REXEC_ACK) {
                        // we are returning after ACK.. not completion.. the worker thread is sending the ACK at start of task
                        yield JAMP.createRemotePutAck(msg.taskid, this.jcore.jamsys.id, msg.nodeid, Timeouts.REXEC_ACK_TIMEOUT);
                        if (msg.subcmd === 1) {
                            let res = await this.checkExecResults(msg.taskid);
                            yield JAMP.createRemotePutRes(msg.taskid, this.jcore.jamsys.id, msg.nodeid, res.res_sig, res.results);
                        }
                    } else
                        yield JAMP.createRemotePutNak(msg.taskid, this.jcore.jamsys.id, msg.nodeid, res.subcmd);
                }
            break;
            case CmdNames.GET_REXEC_RES:
                // we are here.. only when there is an exact execution...
                res = this.jcore.intasktbl.findExact(msg.taskid);
                if (res !== undefined) {
                    // there is an instance of the same task - that is either completed or running
                    if (res.state === INQ_States.COMPLETED)
                        yield JAMP.createRemotePutRes(msg.nodeid, msg.taskid, this.jcore.jamsys.id, res.res_sig, res.results);
                    else {
                        let cres = await this.checkExecResults(msg);
                        this.jcore.intasktbl.updatePCache(msg.fn_name, msg.params, true, cres);
                        yield JAMP.createRemotePutRes(msg.nodeid, msg.taskid, this.jcore.jamsys.id, cres.res_sig, cres.results);
                    }
                } else
                    yield JAMP.createRemotePutErr(msg.nodeid, msg.taskid, this.jcore.jamsys.id, ErrorCodes.NoTask);
            break;
            case CmdNames.MEXEC:
                res = this.jcore.intasktbl.findExact(msg.taskid);
                if (res !== undefined) {
                    // there is an instance of the same task - that is either completed or running
                    if (res.state === INQ_States.COMPLETED)
                        yield JAMP.createMachPutRes(msg.taskid, this.jcore.jamsys.id, msg.nodeid, res.res_sig, res.results);
                    else
                        yield JAMP.createMachPutAck(msg.taskid, this.jcore.jamsys.id, msg.nodeid, Timeouts.REXEC_ACK_TIMEOUT);
                } else {
                    let pres = this.jcore.intasktbl.findApprox(msg.taskid, msg.fn_name, msg.params);
                    if (pres && Math.random() < pres.prob)
                        yield JAMP.createMachPutRes(msg.taskid, this.jcore.jamsys.id, msg.nodeid, pres.res_sig, pres.results)

                    // We did not find in the cache or the function has side effect. In either case,
                    // we need to a new execution. So, we launch the execution and wait for the ACK from
                    // the worker.
                    res = await this.newExecution(msg);
                    if (res !== undefined && res.cmd === CmdNames.MEXEC_ACK) {
                        // we are returning after ACK.. not completion.. the worker thread is sending the ACK at start of task
                        yield JAMP.createMachPutAck(msg.taskid, this.jcore.jamsys.id, msg.nodeid, Timeouts.REXEC_ACK_TIMEOUT);
                        if (msg.subcmd === 1) {
                            let res = await this.checkExecResults(msg.taskid);
                            yield JAMP.createMachPutRes(msg.taskid, this.jcore.jamsys.id, msg.nodeid, res.res_sig, res.results);
                        }
                    } else
                        yield JAMP.createMachPutNak(msg.taskid, this.jcore.jamsys.id, msg.nodeid, res.subcmd);
                }
            break;
            case CmdNames.GET_MEXEC_RES:
                // we are here.. only when there is an exact execution...
                res = this.jcore.intasktbl.findExact(msg.taskid);
                if (res !== undefined) {
                    // there is an instance of the same task - that is either completed or running
                    if (res.state === INQ_States.COMPLETED)
                        yield JAMP.createMachPutRes(msg.taskid, this.jcore.jamsys.id, msg.nodeid, res.res_sig, res.results);
                    else {
                        let cres = await this.checkExecResults(msg);
                        this.jcore.intasktbl.updatePCache(msg.fn_name, msg.params, true, cres);
                        yield JAMP.createMachPutRes(msg.taskid, this.jcore.jamsys.id, msg.nodeid, cres.res_sig, cres.results);
                    }
                } else
                    yield JAMP.createMachPutErr(msg.taskid, this.jcore.jamsys.id, msg.nodeid, ErrorCodes.NoTask);
            break;
        }
        return {cmd: CmdNames.DONE};
    }

    /*
     * This method is used to trigger an new execution at the worker thread. We return a promise which can be later fulfilled.
     */
    async newExecution(msg) {
        let that = this;
        let q = new Promise((resolve, reject)=> {
            that.jcore.intasktbl.putResults(msg.taskid, INQ_States.STARTED, undefined, function(state, res) {
                if (state === INQ_States.STARTED || state === INQ_States.ERROR) {
                    if (msg.subcmd === 0)
                        that.jcore.intasktbl.delete(msg.taskid);
                    else
                        that.jcore.intasktbl.resetCB(msg.taskid);
                    resolve(res);
                }
            });
        });
        icounter = that.jcore.intasktbl.getsize();
        this.jcore.enqueueJob({cmd: msg.cmd, fn_name: msg.fn_name, nodeid: msg.nodeid, taskid: msg.taskid, params: msg.args});
        return q;
    }

    async checkExecResults(id) {
        let that = this;
        let res = this.jcore.intasktbl.findExact(id);
        if (res.state === INQ_States.COMPLETED)
            return {results: res.results, res_sig: res.res_sig};
        else {
            return new Promise((resolve, reject)=> {
                that.jcore.intasktbl.updateCB(id, function(state, results) {
                    if (state === INQ_States.COMPLETED) {
                        that.jcore.intasktbl.delete(id);
                        resolve({results: results, res_sig: res.res_sig});
                    }
                });
            });
        }
    }
}

module.exports = JCoreDaemon;
