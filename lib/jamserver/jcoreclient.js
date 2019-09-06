'use strict';

//===================================================================
// This is the client side of the JAMCore.
// It is responsible for launching the execution calls to
// C nodes and other J nodes.
// The J node remote execution is uptree and downtree.
//===================================================================


const globals = require('./constants').globals;
const cmdopts = require('./cmdparser');
const JAMP = require('./jamprotocol');
const jsys = require('./jamsys');
const cbor = require('cbor');

class JCoreClient {

    constructor(jc) {
        // Only maintain a single instance of the JCoreClient
        if (JCoreClient.this)
            return JCoreClient.this;
        JCoreClient.this = this;

        this.jcore = jc;
        this.scount = 0;
        this.acount = 0;
        this.machtype = jc.machtype;
    }

    remoteSyncExec(name, params, expr, vec, bclock, scount, mlevel, cbid) {

        var that = this;

        if ((mlevel === undefined) ||
            (mlevel === 4 && this.machtype === globals.NodeType.CLOUD) ||
            (mlevel === 2 && this.machtype === globals.NodeType.FOG) ||
            (mlevel === 1 && this.machtype === globals.NodeType.DEVICE)) {

            var tmsg = JAMP.createRemoteSyncReq(name, params, expr, vec, this.machtype, bclock, scount);
            // Insert entry in the runTable with a callback that executes the local function
            // We wait for the ACK from at least one submachine
            tmsg.cbid = cbid;

            // reset the resMap for the new sync exec.
            this.jcore.resMap.clear();
            this.jcore.results = [];
            this.jcore.cNodeCount = 0;

            this.jcore.runTable.insert(tmsg.actid, tmsg, cbid, [{device: this.jcore.mserv, topic: '/' + cmdopts.app + '/mach/func/request'}], function(rstatus) {

                // Return the results when a RES type callback is received.
                // This comes from the machService...
                if (rstatus.code === 'RES') {
                    that.jcore.enqueueJob({cmd: 'REXEC-RES', cbid: tmsg.cbid, data:{device: rstatus.res}});
                    that.jcore.runTable.delete(tmsg.actid);
                } else if (rstatus.code === 'ACK') {
                    that.jcore.runTable.processAck(tmsg.actid, 'device');
                } else {
                    that.jcore.enqueueJob({cmd: 'REXEC-ERR', data:{device: "Time-out-error"}, cbid: tmsg.cbid});
                    that.jcore.runTable.delete(tmsg.actid);                    
                }
            });
        }
    }

    remoteAsyncExec(name, params, expr, vec, bclock, acount, mlevel) {

        var that = this;

        if ((mlevel === undefined) ||
            (mlevel === 4 && this.machtype === globals.NodeType.CLOUD) ||
            (mlevel === 2 && this.machtype === globals.NodeType.FOG) ||
            (mlevel === 1 && this.machtype === globals.NodeType.DEVICE)) {

            // Make the command to send out..
            var tmsg = JAMP.createRemoteAsyncReq(name, params, expr, vec, this.jcore.machtype, bclock, acount);

            // Set timer to cancel the execution if no reply is received within the timeout value
            // TODO: How to set the timeout value?? Why 300 milliseconds?
            var tihandle = setTimeout(function () {
                that.jcore.runTable.delete(tmsg.actid);
            }, globals.Timeouts.J2C_DEVICE);

            // Insert entry in the runTable with a callback that deletes the entry at the first ACK
            // TODO: We could do different things here. Wait for certain number of ACKs to delete
            // Or.. give an extension on the deadline for deletion at each ACK.
            // There is nothing to execute locally...
            this.jcore.runTable.insert(tmsg.actid, tmsg, null, [{device: this.jcore.mserv, topic: '/' + cmdopts.app + '/mach/func/request'}], function(rstatus) {
                // rstatus here is not an object... unlike in the sync case
                if (rstatus.code === 'ACK') {
                    that.jcore.runTable.delete(tmsg.actid);
                    clearTimeout(tihandle);
                }
            });
        }

        // NOTE: the else part for the above 'if' is not needed.
        // We broadcast to the C only if this is the last level. Otherwise, some other J node
        // downtree would broadcast to the C nodes. We don't need to send the message to those
        // J nodes because those J nodes are going to going to run the block anyways.

        // The situation is different in the synchronous case as implemented below
    }


    machSyncExec(name, params, oexpr, vec, bclock, count, mlevel, cbid) {
        
        var that = this;

        // Create the execution call.. message
        var tmsg = JAMP.createMachSyncReq(name, params, oexpr, vec, this.jcore.machtype, bclock, count);

        if (this.machtype === globals.NodeType.DEVICE) {

            this.jcore.runTable.insert(tmsg.actid, tmsg, cbid, [{fog:this.jcore.fserv, topic:'/' + cmdopts.app + '/mach/func/urequest'}],
                                            function(rstatus) {
                if (rstatus.code === 'ERR') 
                    that.jcore.pushErrorToWorker(cbid, rstatus.res);
                else if (rstatus.code === 'RES') 
                    that.jcore.pushResultsToWorker(cbid, rstatus.res);
                that.jcore.runTable.delete(tmsg.actid);
            });

        } else if (this.machtype === globals.NodeType.FOG) {

            this.jcore.runTable.insert(tmsg.actid, tmsg, cbid, [{cloud:this.jcore.cserv, topic:'/' + cmdopts.app + '/mach/func/urequest'},
                                                                    {device:this.jcore.mserv, topic:'/' + cmdopts.app + '/mach/func/request'}],
                                            function(rstatus) {
                if (rstatus.code === 'ERR') 
                    that.jcore.pushErrorToWorker(cbid, rstatus.res);
                else if (rstatus.code === 'RES') 
                    that.jcore.pushResultsToWorker(cbid, rstatus.res);
                that.jcore.runTable.delete(tmsg.actid);
            });
        } else { 

            this.jcore.runTable.insert(tmsg.actid, tmsg, cbid, [{fog:this.jcore.mserv, topic:'/' + cmdopts.app + '/mach/func/request'}],
                                            function(rstatus) {
                if (rstatus.code === 'ERR') 
                    that.jcore.pushErrorToWorker(cbid, rstatus.res);
                else if (rstatus.code === 'RES') 
                    that.jcore.pushResultsToWorker(cbid, rstatus.res);
                that.jcore.runTable.delete(tmsg.actid);
            });
        }
    }

    // Returns true if it is able to launch the specified function
    // Returns false if it determines a failure..
    //
    machAsyncExec(name, params, oexpr, vec, bclock, count, mlevel) {

        var that = this;

        // Create the execution call.. message
        var tmsg = JAMP.createMachAsyncReq(name, params, oexpr, vec, this.machtype, bclock);

        if (this.machtype === globals.NodeType.DEVICE) {

            this.jcore.runTable.insert(tmsg.actid, tmsg, null, [{fog:this.jcore.fserv, 
                                            topic:'/' + cmdopts.app + '/mach/func/urequest'}],
                                                        function(rstatus) {
                if (rstatus.code === 'ACK') 
                    that.jcore.runTable.delete(tmsg.actid);
            });

        } else if (this.machtype === globals.NodeType.FOG) {

            this.jcore.runTable.insert(tmsg.actid, tmsg, null, [{cloud:this.jcore.cserv, 
                                            topic:'/' + cmdopts.app + '/mach/func/urequest'},
                                            {device:this.jcore.mserv, 
                                            topic:'/' + cmdopts.app + '/mach/func/request'}],
                                        function(rstatus) {

                if (rstatus.code === 'ACK') 
                    that.jcore.runTable.delete(tmsg.actid);
            });

        } else if (this.machtype === globals.NodeType.CLOUD) {

            this.jcore.runTable.insert(tmsg.actid, tmsg, null, [{fog:this.jcore.mserv, topic:'/' + cmdopts.app + '/mach/func/request'}],
                                        function(rstatus) {

                if (rstatus.code === 'ACK') 
                    that.jcore.runTable.delete(tmsg.actid);
            });
        }
    }
}

module.exports = JCoreClient;
