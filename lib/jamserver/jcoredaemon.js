'use strict';

const cache = require('./fifocache');
const globals = require('./constants').globals;
const cmdopts = require('./cmdparser');
const cbor = require('cbor');
const JAMP = require('./jamprotocol');
const jsys = require('./jamsys');


class JCoreDaemon {

    constructor(jc) {
        // Maintain only one instance of the JCoreDaemon.. for the system
        if (JCoreDaemon.this)
            return JCoreDaemon.this;
        JCoreDaemon.this = this;

        this.jcore = jc;
        this.machtype = jc.machtype;
        this.activityTable = new Map();
    }

    deleteEntry(actid) {
        var entry = this.activityTable.get(actid);
        if (entry !== undefined) {
            entry.callback = undefined;     // is this necessary?
            this.activityTable.delete(actid);
        }
    }

    sendReply(actid, res) {

        console.log("SendReply.....");
        var entry = this.activityTable.get(actid);
        if (entry !== undefined) {

            var omsg = entry.originmsg;
            var nmsg = {cmd: entry.rescmd, opt: this.machtype, 
                        cond: "-", condvec: 0, actname: omsg["actname"],
                        actid: omsg["actid"], actarg: "RESULTS", args: [res]};
            entry.callback(nmsg);
            this.activityTable.delete(actid);
        }
    }

    machRunner(sock, msg) {

        if (msg['cmd'] === 'MEXEC-ASY' || msg['cmd'] === 'MEXEC-SYN') {
            // We need to get the clock evaluated.
            // We delay the execution by 50ms if the broadcast is not here.
            if (validClock(msg['actarg']))
                this.machRunner2(sock, msg);
            else {
                setTimeout(function() {
                    // Second try.. discard message if not success
                    if (validClock(msg['actarg']))
                        this.machRunner2(sock, msg);
                }, 50);
            }
        } else if (msg['cmd'] === 'MEXEC-RES') {

            this.jcore.runTable.processResults(msg.actid, msg.opt, msg.args);
        } else if (msg['cmd'] === 'MEXEC-ACK') {

            this.jcore.runTable.processAck(msg.actid, msg.opt);
        }
    }

    machRunner2(sock, msg) {

        var that = this; 

        // Skip this if it a duplicate
        if (cache.duplicate(msg['actid'])) {
            JAMP.sendMachAcknowledge(sock, this.jcore.fserv, this.jcore.cserv, this.machtype, cmdopts.app, msg);
            return;
        }

        switch (msg['cmd']) {

            case 'MEXEC-ASY':
                JAMP.sendMachAcknowledge(sock, this.jcore.fserv, this.jcore.cserv, this.machtype, cmdopts.app, msg);
                this.jcore.enqueueJob({cmd: 'MEXEC-ASY', cond: msg.cond, name: msg.actname, actid: msg.actid, args: msg.args});


            break;
            case 'MEXEC-SYN':
                
                // Send ack to the sending nodes. This is just acking the receipt. 
                // There is no ack for the actual execution start.
                //
                JAMP.sendMachAcknowledge(sock, this.jcore.fserv, this.jcore.cserv, this.machtype, cmdopts.app, msg);    
                // Set the activity table entry
                //
                this.activityTable.set(msg["actid"], {originmsg: msg, rescmd: 'REXEC-RES', callback: function(omsg) {
                    JAMP.sendMachReply(sock, that.jcore.fserv, that.jcore.cserv, that.machtype, cmdopts.app, omsg);
                }});
                // Queue the request for local execution..
                this.jcore.enqueueJob({cmd: 'MEXEC-SYN', cond: msg.cond, name: msg.actname, actid: msg.actid, args: msg.args});

            break;
        }
    }


    // The machine service handler..
    // Used to process messages bubbling upwards... lets treat one message type at a time
    // Only one message is going upwards from a subtree..
    //
    machService(msg) {

        // Take action: remove from runTable on ACK ..
        switch (msg['cmd']) {
            case 'MEXEC-ACK':
            case 'REXEC-ACK':
                var runid = msg['actid'];
                var rentry = this.jcore.runTable.get(runid);
                if (rentry !== undefined) {
                    var callback = rentry.cback;
                    if (msg.opt === "SYN")
                        this.jcore.cNodeCount++;
                    callback({code: 'ACK', res: ''});
                }
            break;
            case 'REXEC-RES':
                var runid = msg['actid'];
                var rentry = this.jcore.runTable.get(runid);
                if (rentry !== undefined) {
                    
                    var callback = rentry.cback;
                    // console.log(msg);
                    var si = this.jcore.resMap.size;

                    this.jcore.resMap.set(msg['actarg'], msg['args'][0]);
                    if (this.jcore.resMap.size > si) {
                        this.jcore.results.push(msg['args'][0]);
                    }

                    console.log("Resmap size ", this.jcore.resMap.size, " NodeCount ", this.jcore.cNodeCount);

                    // Received results from all C nodes.
                    if (this.jcore.resMap.size >= this.jcore.cNodeCount) {
                        callback({code: 'RES', res: this.jcore.results});
                        // Reset the result array
                        this.jcore.results = [];
                        this.jcore.resMap.clear();
                    }
                }
            break;
        }
    }

    // The level service handler..
    //
    levelService(msg, callback) {

        // Skip this if it a duplicate
        if (cache.duplicate(msg['actid'])) {
            if (this.activityTable.get(msg['actid'])) {
                msg.cmd = "REXEC-ACK";
                callback(msg);
                return;
            }
        }

        switch (msg['cmd']) {
            case 'REXEC-SYN':
                console.log("REXEC-SYN.....", msg);
                // Check whether this node is the "Root" for the request.
                // It depends on both the request and the node itself
                if (msg['opt'] === 'RTE' && this.jcore.iamRoot(msg['condvec']))
                    this.runSyncCallbackRTE(msg, callback);
                else
                if (msg['opt'] === 'NRT' && !this.jcore.iamRoot(msg['condvec']))
                    this.runSyncCallbackNRT(msg, callback);
                console.log("End...");
            break;
            case 'REXEC-ASY':
                // Processing: [[ REXEC-ASY condition-string/- actname actid device_id args ]]
                // Check the actname, return error if not found
                // Check condition string, return error if not true
                // Send positive ack in other cases
                this.runAsyncCallback(msg, callback);

            break;
            case 'REXEC-ASY2':
                // Run the command in deferred mode -- TODO: This is missing!!
                this.runDeferredAsync(msg);
            break;
            default:
                console.log('LevelService:: UNKNOWN CMD: ' + msg['cmd'] + ' received..');
                throw('UNKNOWN COMMAND');
        }
    }

    // =============================================================================
    // Callback routines. These routines are used in a reactive manner by the
    // services. They are majorly used to run functions to implement the remote
    // execution calls.
    // =============================================================================

    // This function does the following..
    // One success.. it calls the callback with the following message
    // [[ REXEC-ACK - ACTIVITY actid device_id lease-value (arg0) ]]
    // It fails on many conditions: function not found, condition not true,
    // illegal parameters, etc. Sends the following message on failure
    // [[ REXEC-NAK - ACTIVITY actid device_id error-code (arg0) ]]
    //
    runSyncCallbackRTE(cmsg, callback) {


        var rmsg = JSON.parse(JSON.stringify(cmsg));            // copy the incoming message to form the reply
        rmsg.opt = this.machtype;

   		// create actid, select lease-value, put entry in the activity table
   		// send [REXEC-ACK SYN ACTIVITY actid device_id lease-value (arg0) ]
   		this.activityTable.set(cmsg["actid"], {callback: callback, originmsg: cmsg, rescmd: 'REXEC-RES'});
        rmsg.cmd = "REXEC-ACK";
        callback(rmsg);
        console.log("Enqueueing....");
        this.jcore.enqueueJob({cmd: 'REXEC-SYN', cond: cmsg.cond,  name: cmsg.actname, actid: cmsg.actid, args: cmsg.args});
    }

    runSyncCallbackNRT(cmsg, callback) {

        var rmsg = JSON.parse(JSON.stringify(cmsg));     // copy the incoming message to form the reply
        rmsg.opt = this.machtype;

        if (this.checkCondition(cmsg["cond"]) !== true) {
            rmsg.cmd = "REXEC-NAK";
            rmsg.args = ["CONDITION-FALSE"];
            callback(rmsg);
        } else {
    		// create actid, select lease-value, put entry in the activity table
    		// send [REXEC-ACK SYN ACTIVITY actid device_id lease-value (arg0) ]
            rmsg.cmd = "REXEC-ACK";
            callback(rmsg);
            // Run function
            
    		var res = fentry.func.apply(this, cmsg["args"]);
            // This is NOT a root.. so no result broadcast
    	}
    }

    runAsyncCallback(cmsg, callback) {

        var rmsg = JSON.parse(JSON.stringify(cmsg)); 
        rmsg.opt = this.machtype;

        this.activityTable.set(cmsg["actid"], "Started");
    	// send [REXEC-ACK ASY ACTIVITY actid device_id lease-value (arg0) ]
        rmsg.cmd = "REXEC-ACK";
        callback(rmsg);

        // Run function at the worker thread
        this.jcore.enqueueJob({cmd: cmsg.cmd, cond: cmsg.cond, name: cmsg.actname, args: cmsg.args});
        this.activityTable.set(cmsg["actid"],  "Completed");
    }

    checkCondition(cond) {

        if (cond === "")
            return true;
        var tstr = eval(cond);
        if (tstr === "")
            return true;

        return eval(tstr);
    }


}

// Check whether the current clock is greater than or
// equal to the received clock
//
function validClock(aarg) {

    // No clock in the message
    if (aarg === '-')
        return true;

    var arr = aarg.split('|');

    var rclock = parseFloat(arr[1], 10);

    var barr = arr[0].split(',');
    var mclock = 0.0;
    barr.forEach(function(b) {
        var tclock = parseFloat(bc[b].getClock());
        if (tclock > mclock)
            mclock = tclock;
    });

    if (rclock <= mclock)
        return true;
    else
        return false;
}


function checkArgsType(args, mask) {
    var m;

    if (args.length !== mask.length)
        return false;

    for (m in mask) {
        switch (mask[m]) {
            case 's':
                if (typeof(args[m]) !== 'string')
                    return false;
                break;
            case 'i':
                if (typeof(args[m]) !== 'number')
                    return false;
                break;
        }
    }
    return true;
}







module.exports = JCoreDaemon;
