'use strict';

const   globals = require('../utils/constants').globals,
        StateNames = require('../utils/constants').StateNames,
        CmdNames = require('../utils/constants').CmdNames,
        cmdOpts = require('../utils/cmdparser'),
        JAMP = require('../utils/jamprotocol'),
        cbor = require('cbor-x');

/*
 * This is the client side of the JAMCore. It is responsible for launching 
 * the execution calls to C nodes and other J nodes. For the C nodes the calls 
 * are always downtree. For the J nodes it is downtree (fogs send to devices) and 
 * uptree (devices send to fogs, fogs send to cloud).
 */
class JCoreClient {
    constructor(jc) {
        if (JCoreClient.this)
            return JCoreClient.this;
        JCoreClient.this = this;
        this.jcore = jc;
    }

    /*
     * Send a Controller-worker task execution. We send the request and then insert the request 
     * into the OutTaskTable, which tracks the request. The OTT is registered with two callbacks.
     * One for getting feedback to the application thread. It is important to note that we are in 
     * the main thread and the actual application is not running here. We need to get back to the
     * original application in the other thread and notify regarding the different conditions 
     * of the outstanding execution request. The first callback is for the communication with the
     * application thread.
     * 
     * The second callback is for retry management. 
     */    
    remoteTaskExec(name, argsig, params, nodeid, taskid, rrequired) {
        let that = this;

        let req = JAMP.createRemoteTaskReq(name, argsig, params, nodeid, taskid, rrequired);
        this.jcore.me.serv.publish('/' + cmdOpts.app + '/requests/down/c', cbor.encode(req));
        this.jcore.otasktbl.insert(nodeid + taskid, function cb(code, val) {
            switch (code) {
                case StateNames.TIMEOUT:
                case StateNames.ERR_RECVD:
                    that.jcore.enqueueJob({cmd: CmdNames.REXEC_ERR, nodeid: nodeid, taskid: taskid});
                    that.jcore.otasktbl.delete(nodeid + taskid);
                break
                case StateNames.CLOSING:
                    that.jcore.enqueueJob({cmd: CmdNames.REXEC_CLS, nodeid: nodeid, taskid: taskid});
                    that.jcore.otasktbl.delete(nodeid + taskid);
                break;
                case StateNames.ACK_RECVD:
                    //console.log("ACK RECVD ................", taskid);
                    that.jcore.enqueueJob({cmd: CmdNames.REXEC_ACK, nodeid: nodeid, taskid: taskid});
                    if (rrequired)
                        that.jcore.otasktbl.extendlife(nodeid + taskid);
                    else 
                        that.jcore.otasktbl.delete(nodeid + taskid);
                break;
                case StateNames.RES_RECVD:
                   // console.log("RES RECVD ................", taskid);
                    that.jcore.enqueueJob({cmd: CmdNames.REXEC_RES, nodeid: nodeid, taskid: taskid, data: val});
                   // that.jcore.otasktbl.close(nodeid + taskid);
            }
        }, function retry(state) {
            if (state === StateNames.INITIAL)
                that.jcore.me.serv.publish('/' + cmdOpts.app + '/requests/down/c', cbor.encode(req));
            else if (state === StateNames.BOOSTED && rrequired) {
                let getres = JAMP.createRemoteGetRes(name, nodeid, taskid);
                that.jcore.me.serv.publish('/' + cmdOpts.app + '/requests/down/c', cbor.encode(getres));
            }
        });
    }

    /* 
     * The as the above call for Controller-Controller calls. One difference is the way the request 
     * is pushed. Instead of just sending it to one group (e.g., workers), we send the request to different
     * groups depending on the origin.
     */
    machTaskExec(name, params, nodeid, taskid, rrequired) {
        let that = this;

        let req = JAMP.createMachTaskReq(name, params, nodeid, taskid);
        this.__sendMachRequest(req, this.jcore);
        this.jcore.otasktbl.insert(nodeid + taskid, function cb(code, val) {
            switch (code) {
                case StateNames.TIMEOUT:
                    that.jcore.enqueueJob({cmd: CmdNames.MEXEC_ERR, nodeid: nodeid, taskid: taskid});
                    that.jcore.otasktbl.delete(nodeid + taskid);
                break;
                case StateNames.CLOSING:
                    that.jcore.enqueueJob({cmd: CmdNames.MEXEC_CLS, nodeid: nodeid, taskid: taskid});
                    that.jcore.otasktbl.delete(nodeid + taskid);
                break;
                case StateNames.ACK_RECVD:
                    that.jcore.enqueueJob({cmd: CmdNames.MEXEC_ACK, nodeid: nodeid, taskid: taskid});
                    if (rrequired)
                        that.jcore.otasktbl.extendlife(nodeid + taskid);
                    else 
                        that.jcore.otasktbl.delete(nodeid + taskid);
                break;
                case StateNames.RES_RECVD:
                    that.jcore.enqueueJob({cmd: CmdNames.MEXEC_RES, nodeid: nodeid, taskid: taskid, data: val});
                //    that.jcore.otasktbl.delete(nodeid + taskid);
            }
        }, function retry(state) {
            if (state === StateNames.INITIAL)
                that.__sendMachRequest(req, that.jcore);
            else if (state === StateNames.ACK_RECVD && rrequired) {
                let getres = JAMP.createMachGetRes(name, nodeid, taskid);
                that.__sendMachRequest(getres, that.jcore);
            }
        });
    }

    __sendMachRequest(tmsg, jcore) {
        let msg = cbor.encode(tmsg);
        if (jcore.jamsys.machtype === globals.NodeType.DEVICE) {
            // publish at all fogs - multiple publish 
            let topic = '/' + cmdOpts.app + '/requests/up';
            jcore.fogs.forEach((f)=> {
                if (f.serv !== undefined)
                    f.serv.publish(topic, msg);
            });
        } else if (jcore.jamsys.machtype === globals.NodeType.FOG) {
            // publish for all devices and publish at the cloud - two 
            jcore.me.serv.publish('/' + cmdOpts.app + '/requests/down/j', msg);
            if (jcore.cloud !== undefined && jcore.cloud.serv !== undefined)
                jcore.cloud.serv.publish('/' + cmdOpts.app + '/requests/up', msg);
        } else if (jcore.jamsys.machtype === globals.NodeType.CLOUD) {
            // publish downward for all fogs - single publish
            jcore.me.serv.publish('/' + cmdOpts.app + '/requests/down/j', msg);
        }
    }
}

module.exports = JCoreClient;
