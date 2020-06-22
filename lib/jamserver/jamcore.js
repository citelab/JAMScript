'use strict';

//===================================================================
// This is the core component for J node processing.
// All processing is linked to this component..
//===================================================================
const jsys = require('./jamsys');
const globals = require('./constants').globals;
const mqtt = require('mqtt');
const cbor = require('cbor');
const ebus = require('./ebus');
const deviceParams = require('./deviceparams');
const mqttconsts = require('./constants').mqtt;
const cmdopts = require('./cmdparser');
const JAMP = require('./jamprotocol');
const path = require('path');

const JCoreAdmin = require('./jcoreadmin');
const JCoreDaemon = require('./jcoredaemon');
const JCoreClient = require('./jcoreclient');
const RunTable = require('./runtable');
const NodeCache = require('./nodecache');

class JAMCore {

    constructor(reg, mtype) {
        // Maintain only one instance of the JAMCore.. for the system
        if (JAMCore.this)
            return JAMCore.this;
        JAMCore.this = this;
        this.reggie = reg;
        this.machtype = mtype;
        this.resMap = new Map();
        this.results = [];
        this.cNodeCountACK = 0;
        this.cNodeCountNAK = 0;
        this.deviceIds = new Set();
        this.startEnabled = false;
        this.jobQueue = new Array();
        this.workerBusy = false;
        this.ncache = this.getNcache(jsys.link);
        this.funcRegistry = new Map();
        this.copts = {
                    will: {topic: "/" + cmdopts.app + "/admin/announce/all",
                        payload: cbor.encode({"cmd": "KILL", "opt": "ALL", "cond": "-", "condvec": 0, "actname": "-", "actid": "-", "actarg": "-", "args": []}),
                        qos: 1,
                        retain: 0},
                    clientId: deviceParams.getItem('deviceId'),
                    keepalive: mqttconsts.keepAlive,
                    clean: false,
                    connectTimeout: mqttconsts.connectionTimeout,
                };

        this.fserv = null;
        this.cserv = null;
        // Start the core extensions
        this.jclient = new JCoreClient(this);
        this.jadmin = new JCoreAdmin(this);
        this.jdaemon = new JCoreDaemon(this);
    }

    run() {
        if (this.machtype === globals.NodeType.CLOUD) {
            this.reggie.registerAndDiscover();
            this.startService();
            this.startRunner();
        } else {
            this.jadmin.doRegister();
            this.startService();
            this.startRunner();
        }
    }

    setWorker(worker) {
        this.worker = worker;
        var that = this;

        // The worker needs to get one job at a time. So, we need to dispatch a job when the worker is 
        // available, if we postMessage (i.e., send job) when the worker is busy the job will be dropped.
        // We receive a message back ("ack") when the worker is done with the current job. Initially, the 
        // worker is free. 
        if (this.jobQueue.length > 0) {
            const job = this.jobQueue.shift();
            this.worker.postMessage(job);
            if (job.cmd !== 'CTX-CALLBACK') {
                this.workerBusy = true;
            }
        }

        this.worker.onmessage = function(val) {
            // Received an Ack from the worker, process it, and send another job if there is one
            that.processWorkerMsg(val.data);
            if (val.data.cmd !== 'CTX-CALLBACK-DONE') {
                that.workerBusy = false;
                if (that.jobQueue.length > 0) {
                    const job = that.jobQueue.shift();
                    that.worker.postMessage(job);
                    if (job.cmd !== 'CTX-CALLBACK') {
                        that.workerBusy = true;
                    }
                }
            }
        };

        // Register all the other callback type jobs
        this.ncache.onFogDataUp(function(info) {
            that.enqueueJob({cmd: 'NCACHE-MOD', opt: 'FOG-DATA-UP', data: info});
        });
        this.ncache.onFogDataDown(function() {
            that.enqueueJob({cmd: 'NCACHE-MOD', opt: 'FOG-DATA-DOWN'});
        });
        this.ncache.onCloudDataUp(function(info) {
            that.enqueueJob({cmd: 'NCACHE-MOD', opt: 'CLOUD-DATA-UP', data: info});
        });
        this.ncache.onCloudDataDown(function() {
            that.enqueueJob({cmd: 'NCACHE-MOD', opt: 'CLOUD-DATA-DOWN'});
        });
    }

    enqueueJob(job) {
        if (this.workerBusy) {
            this.jobQueue.push(job);
        } else {
            if (this.worker !== undefined) {
                this.worker.postMessage(job);
                if (job.cmd !== 'CTX-CALLBACK') {
                    this.workerBusy = true;
                }
            } else {
                this.jobQueue.push(job);
            }
        }
    }

    processWorkerMsg(r) {

        switch (r.cmd) {
            case 'REXEC-ASY':
                this.jclient.remoteAsyncExec(r.name, r.params, r.expr, r.vec, r.bclock, r.count, r.mlevel);
                break;
            case 'REXEC-SYN':
                if (r.ctxid != null) {
                    this.jclient.remoteSyncCtxExec(r.name, r.params, r.expr, r.vec, r.bclock, r.count, r.mlevel, r.cbid, false);
                } else {
                    this.jclient.remoteSyncExec(r.name, r.params, r.expr, r.vec, r.bclock, r.count, r.mlevel, r.cbid);
                }
                break;
            case 'MEXEC-ASY':
                this.jclient.machAsyncExec(r.name, r.params, r.expr, r.vec, r.bclock, r.count, r.mlevel);
                break;
            case 'MEXEC-SYN':
                this.jclient.machSyncExec(r.name, r.params, r.expr, r.vec, r.bclock, r.count, r.level, r.cbid);
                break;
            case 'REXEC-RES':
                this.jdaemon.sendReply(r.actid, r.data);
                break;
            case 'MEXEC-RES':
                var nmsg = {cmd: "MEXEC-RES", opt: this.machtype, 
                    cond: "-", condvec: 0, actname: r.name,
                    actid: r.actid, actarg: "RESULTS", args: [r.data]};
                JAMP.sendMachReply(this.mserv, this.fserv, this.cserv, this.machtype,  cmdopts.app, nmsg);
            break;
            case 'REXEC-ERR':
                console.log("ERROR posted.. for ", r.actid);
            break;
            case 'DATA-UP':
                jsys.setRedis(r.host, r.port);
                ebus.dataUp(r.host, r.port);
                jsys.adUp('datadepot', {host: r.host, port: r.port});
            break;
            case 'SET-CONF':
                if (r.opt === 'SET-LAT')
                    jsys.setLat(r.data);
                else if (r.opt === 'SET-LONG')
                    jsys.setLong(r.data);
            break;
            case 'CTX-CALLBACK-DONE':
                // uncomment for perf test
                /*
                if (this.context.contextId == jsys.tags) {
                    const timestamp = process.hrtime.bigint().toString();
                    const filename = path.basename(__filename);
                    throw new Error(`${timestamp} [main:${filename}] Programmatic failure`);
                }
                */
                this.context.setFogDone();
                this.context.checkDone();
            break;
        }
    }

    pushErrorToWorker(opt, cbid, msg) {
        this.enqueueJob({cmd: 'REXEC-ERR', opt: opt, cbid: cbid, data: msg});
    }

    pushResultsToWorker(cbid, data) {
        this.enqueueJob({cmd: 'REXEC-RES', cbid: cbid, data: data});
    }

    registerCallback(name, fk, mask) {
        if (name === "" || name === undefined) {
            console.log("Anonymous functions cannot be callbacks... request ignored");
            return;
        }
        if (this.funcRegistry.has(name)) {
            console.log("Duplicate registration: " + name + ".. overwritten.");
        }
        this.funcRegistry.set(name, {func: fk, mask:mask});
    }

    startService() {
        // Changes
        this.mserv = mqtt.connect("tcp://localhost:" + cmdopts.port, this.copts);
        var that = this;
        // Setup the runTable
        this.runTable = new RunTable(this);
        this.mserv.on('connect', function() {
            that.mserv.subscribe('/' + cmdopts.app + '/admin/request/all');
            that.mserv.subscribe('/' + cmdopts.app + '/level/func/request');
            that.mserv.subscribe('/' + cmdopts.app + '/mach/func/reply');
            // Changes
            that.mserv.subscribe('/' + cmdopts.app + '/mach/func/syncrequest');

            // Send a ping every 50 0 milliseconds. This is needed so that the clients waiting at the
            // broker will know about a newly joining broker
            //
            doPing(that.mserv);
            setInterval(function() {
                doPing(that.mserv);
            }, 10000);

            const contextManager = jsys.getContextManager();
            if (contextManager) {
                contextManager.broker = that.mserv;
            }
        });
        this.mserv.on('reconnect', function() {
            that.mserv.subscribe('/' + cmdopts.app + '/admin/request/all');
            that.mserv.subscribe('/' + cmdopts.app + '/level/func/request');
            that.mserv.subscribe('/' + cmdopts.app + '/mach/func/reply');
            // Changes
            that.mserv.subscribe('/' + cmdopts.app +'/mach/func/syncrequest');

            // Send a ping every 500 milliseconds. This is needed so that the clients waiting at the
            // broker will know about a newly joining broker
            //
            setInterval(function() {
                var tmsg = {"cmd": "PING", "opt": "BROKER", "cond": "-", "condvec": 0, "actname": "-", "actid": "-", "actarg": "-", "args": []};
                var encode = cbor.encode(tmsg);
                process.stdout.write(".");
                that.mserv.publish('/' + cmdopts.app + '/admin/announce/all', encode);
            }, 50000);
        });

        this.mserv.on('message', function(topic, buf) {
            cbor.decodeFirst(buf, function(error, msg) {
                switch (topic) {
                    case '/' + cmdopts.app + '/admin/request/all':
                    // Requests are published here by nodes under this broker
                        try {
                            that.jadmin.adminService(msg, function(rmsg) {
                                var encode = cbor.encode(rmsg);
                                that.mserv.publish('/' + cmdopts.app +'/admin/announce/all', encode);
                            });
                        } catch (e) {
                            console.log("ERROR!: ", e);
                        }
                    break;
                    case '/' + cmdopts.app + '/level/func/request':
                    // These are requests by the C nodes under this broker
                    // The requests are published from device and fog levels
                        try {
                            that.jdaemon.levelService(msg, function(rmsg) {
                                var encode = cbor.encode(rmsg);
                                that.mserv.publish('/' + cmdopts.app +'/level/func/reply/' + rmsg["actarg"], encode);
                            });
                        } catch (e) {
                            console.log("ERROR!: ", e);
                        }
                    break;
                    case '/' + cmdopts.app + '/mach/func/reply':
                    // Replies are bubbling upwards. So these are publications
                    // coming from submachines.
                        try {
                            that.jdaemon.machService(msg);
                        } catch (e) {
                            console.log("ERROR!: ", e);
                        }
                    break;
                    // Changes
                    case '/' + cmdopts.app + '/mach/func/syncrequest' :
                        try {
                            // Use the set to record the different nodes that are ready
                            if (that.deviceIds.size === 0) {
                                setTimeout(() => {
                                    if (that.cNodeCountACK >= that.cNodeCountNAK) {
                                        that.startEnabled = true;
                                        that.checkSyncStart();
                                    } else {
                                        that.sendSyncStart(-1);
                                        that.context.callback({code: 'CANCEL'});
                                    }
                                }, 500);
                            }
                            that.deviceIds.add(msg.actid);
                            that.checkSyncStart();
                        } catch(e) {
                            console.log("ERROR!: ", e);
                        }
                    break;
                }
            });
        });
    }

    checkSyncStart() {
        if (this.startEnabled && this.deviceIds.size >= this.cNodeCountACK) {
            if (this.context) {
                this.enqueueJob({
                    cmd: 'CTX-CALLBACK',
                    cbid: this.context.cbid,
                    args: [{contextId: this.context.contextId, deviceIds: [...this.deviceIds]}],
                });
            }
            this.sendSyncStart(this.calcStartTime());
            this.startEnabled = false;
        }
    }

    sendSyncStart(startTime) {
        this.mserv.publish('/' + cmdopts.app + '/mach/func/syncstart', '' + startTime);
    }

    calcStartTime() {
        const now = new Date().getTime() / 1000.0;
        // the exact time that all C nodes should start their jobs
        const startTime = now + 0.2;
        return startTime;
    }

    startRunner() {
        var sock;
        // Every node listens to the up messages.
        this.runnerSockConfig(this.mserv, '/' + cmdopts.app + '/mach/func/urequest');
        // Cloud does not need the runner.
        if (this.machtype === globals.NodeType.CLOUD)
            return;
        else if (this.machtype === globals.NodeType.FOG) 
            sock = this.cserv;
        else
            sock = this.fserv;

        // No need to run startRunner.. if the device is not connected to the fog..
        // Or the fog is not connected to the cloud..
        if (sock === undefined)
            return;

        this.runnerSockConfig(sock, '/' + cmdopts.app + '/mach/func/request', `/${cmdopts.app}/${jsys.zone}/zoneconf`);
    }

    runnerSockConfig(sock, ...msgtopics) {
        var that = this;
        if (sock === null || sock === undefined)
            return;

        sock.on('connect', function() {
            sock.subscribe(msgtopics);
        });
        sock.on('reconnect', function() {
            sock.subscribe(msgtopics);
        });
        sock.on('message', function(topic, buf) {
            if (msgtopics.includes(topic)) {
                cbor.decodeFirst(buf, function(error, msg) {
                    try {
                        that.jdaemon.machRunner(sock, msg);
                    } catch (e) {
                        console.log("ERROR!: ", e);
                    }
                });
            }
        });
    }

    // Returns true if I am Root
    iamRoot(n) {
        switch (n & 0x7) {
            // JCond did not specify a level
            case 0:
            // Return true if I am cloud
            if (this.machtype == globals.NodeType.CLOUD)
                return true;
            // Return true if I am fog and no cloud
            if (this.machtype == globals.NodeType.FOG && this.cserv === null)
                return true;
            // Return true if I am device and no fog and no cloud
            if (this.machtype == globals.NodeType.DEVICE && this.cserv === null && this.fserv === null)
                return true;
            break;
            // JCond wants device
            case 1:
            if (this.machtype == globals.NodeType.DEVICE)
                return true;
            break;
            // JCond wants Fog
            case 2:
            if (this.machtype == globals.NodeType.FOG)
                return true;
            break;
            // JCond wants Cloud
            case 4:
            if (this.machtype == globals.NodeType.CLOUD)
                return true;
            break;
        }
        // Otherwise return false
        return false;
    }

    getNcache() {
        if (this.ncache === undefined) {
            this.ncache = new NodeCache(200, 2, 2000, jsys.link);
        }
        return this.ncache;
    }
}

function doPing(serv) {

    var tmsg = {"cmd": "PING", "opt": "BROKER", "cond": "-", "condvec": 0, "actname": "-", "actid": "-", "actarg": "-", "args": []};
    var encode = cbor.encode(tmsg);
    serv.publish('/' + cmdopts.app +'/admin/announce/all', encode);
}

module.exports = JAMCore;
