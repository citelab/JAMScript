'use strict';

/* 
 * This is the core component for J node processing.
 * All processing is linked to this component.
 */
const   CmdNames = require('../utils/constants').CmdNames,
        globals = require('../utils/constants').globals,
        constants = require('../utils/constants'),
        cbor = require('cbor-x'),
        udp = require('dgram'),
        ebus = require('./ebus'),
        {exec} = require('node:child_process'),
        cmdOpts = require('../utils/cmdparser'),
        helper = require('../utils/helper'),
        OutTaskTable = require('./outtasktable'),
        JAMP = require('../utils/jamprotocol'),
        Registrar = require('../jdiscovery');

const   JCoreAdmin = require('../modules/jcoreadmin'),
        JCoreDaemon = require('../modules/jcoredaemon'),
        JCoreClient = require('../modules/jcoreclient'),
        NodeCache = require('./nodecache');
const { INQ_States } = require('../utils/constants');

let oldLoc = {long: 0, lat: 0};
// TODO: how can we set this variation thresholds - put these into the constants.js??
const minFogLocVariation = 10;
const minDevLocVariation = 10;

class JAMCore {

    constructor(jsys, reggie) {
        if (JAMCore.this)
            return JAMCore.this;
        JAMCore.this = this;
        this.jamsys = jsys;
        this.jobQueue = new Array();
        this.itaskq = new Map();
        this.otasktbl = new OutTaskTable(this);
        this.workerBusy = false;
        this.ncache = this.getNcache(this.jamsys);
        this.fogs = new Array();
        this.cloud = undefined;
        this.funcRegistry = new Map();
        this.reggie = reggie;
        /*
         * me could be different types depending on the machine type
         * for instance, at a fog, me would be the fog server. it would not 
         * have other fogs. it could have the cloud server.
         */
        this.me = undefined;
        this.actIDCounter = 1;
        this.id = this.jamsys.id;
        /* 
         * start the discovery service that would respond to requests from
         * the worker.
         */
        if (this.jamsys.machtype === 'device')
            this.discoveryProcessor(cmdOpts);
        /*
         * Start the core extensions
         */
        this.jclient = new JCoreClient(this);
        this.jadmin = new JCoreAdmin(this);
        this.jdaemon = new JCoreDaemon(this);

    }

    async run() {
        this.me = this.makeServer(this.jamsys.id, this.jamsys.mqtt.server, cmdOpts.port, this.jamsys.machtype);
        // doRegister is setting up the device and fog layers to listen upwards
        if (this.jamsys.machtype === globals.NodeType.CLOUD)
            this.jamsys.reggie.registerAndDiscover();
        else
            this.jadmin.doRegister();
        this.startMainProcessors(this.me.serv);
    }

    addWorker(worker) {
        this.worker = worker;
        let that = this;
        this.worker.postMessage([{cmd: CmdNames.SET_JSYS, data: {redis: this.jamsys.redis, nodeid: this.jamsys.id, type: this.jamsys.machtype, tags: this.jamsys.tags, long: this.jamsys.long, lat: this.jamsys.lat}}]);

        if (this.jobQueue.length > 0) {
            this.worker.postMessage(this.jobQueue); 
            this.jobQueue = new Array();
            this.workerBusy = true;
        }

        this.worker.on('message', function(val) {
            /*
             * Process worker could get ACK messages.. they do not mean the worker is free
             * So we cannot send a job in response to the ACK.
             */
            if (that.processWorkerMsg(val)) {
                if (that.jobQueue.length > 0) {
                    that.worker.postMessage(that.jobQueue);
                    that.jobQueue = undefined;
                    that.jobQueue = new Array();
                    that.workerBusy = true;
                } else
                    that.workerBusy = false;
            }
        });
    }

    enqueueJob(job) {
        if (this.workerBusy)
            this.jobQueue.push(job);
        else {
            if (this.worker !== undefined) {
                this.worker.postMessage([job]);
                this.workerBusy = true;
            } else
                this.jobQueue.push(job);
        }
    }

    /*
     * REXEC_ASY and related commands are sending requests to the other side. So, we are 
     * using jclient for that purpose. REXEC_ACK is sending out replies to requests 
     * that came from another node. So, we are using the daemon.
     */
    processWorkerMsg(r) {
        switch (r.cmd) {
            case CmdNames.REXEC:
                this.jclient.remoteTaskExec(r.fn_name, r.argsig, r.params, this.id, r.taskid, r.results);
                break;
            case CmdNames.MEXEC:
                this.jclient.machTaskExec(r.fn_name, r.params, this.id, r.taskid, r.results);
                break;
            case CmdNames.REXEC_ACK:
            case CmdNames.MEXEC_ACK:
                this.processWorkerAck(r.taskid, r);
                break;
            case CmdNames.REXEC_RES:
            case CmdNames.MEXEC_RES:
                this.processWorkerResults(r.taskid, r.data);
                break;
            case CmdNames.REXEC_NAK:
            case CmdNames.MEXEC_NAK:
                // Whole message is sent to the NAK processor
                this.processWorkerNak(r.taskid, r);
                break;
            case CmdNames.REXEC_ERR:
            case CmdNames.MEXEC_ERR:
                // Error processor is sent the whole message
                this.processWorkerError(r.taskid, r);
                break;
            case CmdNames.SET_CONF:
                if (r.opt === CmdNames.SET_LOC)
                    this.updateLocation(r.data);
            break;
            case CmdNames.SET_REDIS:
                this.updateRedis(r.data);
            break;
            case CmdNames.HOIST_FOG:
                console.log(r);
                this.hoistFog(r.opt, r.data);
            break;
            default:
                // TODO: Remove this after debugging it properly
                // console.log("Unknown...", r.cmd);
            break;
        }
        return true;
    }

    async startAuxProcessors(sock) {
        let that = this;
        sock.on('connect', function() {
            helper.setMQTTSubscriptions_aux(sock, cmdOpts);
            return true;
        });
        sock.on('reconnect', function() {
            helper.setMQTTSubscriptions_aux(sock, cmdOpts);
            return true;
        });
        sock.on('error', function(e) {
            console.log("error: " + e);
            return false;
        });
        sock.on('message', function(topic, buf) {
            let qmsg = cbor.decode(buf);
            qmsg.taskid = Number(qmsg.taskid);          // to convert from bigint
            auxmessageProcessor(that, sock, topic, qmsg);
        });
    }

    /* 
     * We just have single version of the mainProcessor and run it by default in all types of
     * nodes. Some of the protocols supported would not run depending on the type of node.
     */

    async startMainProcessors(sock) {
        let that = this;
        sock.on('connect', function() {
            helper.setMQTTSubscriptions(sock, cmdOpts);
            helper.repeatPing(sock, cmdOpts, globals.Timeouts.PING_DURATION);
            return true;
        });
        sock.on('reconnect', function() {
            helper.setMQTTSubscriptions(sock, cmdOpts);
            helper.repeatPing(sock, cmdOpts, globals.Timeouts.PING_DURATION);
            return true;
        });
        sock.on('error', function(e) {
            console.log("error: " + e);
            return false;
        });
        sock.on('message', function(topic, buf) {
            let qmsg = cbor.decode(buf);
            qmsg.taskid = Number(qmsg.taskid);
            messageProcessor(that, sock, topic, qmsg);
        });
    }

    discoveryProcessor(cmdo) {
        let that = this;
        const multicast_addr = constants.multicast.Prefix + "." +  cmdOpts.group;
        const rport = constants.multicast.rPort; //16000
        const sport = constants.multicast.sPort; //16500

        const listener = udp.createSocket({type:"udp4", reuseAddr:true}),
            sender = udp.createSocket({type:"udp4", reuseAddr:true});

        // receiving on 16000
        listener.bind(rport, multicast_addr, function() {
            listener.addMembership(multicast_addr);
            listener.setBroadcast(true);
        });

        listener.on("message", function (msg, err) {
            let qmsg = cbor.decode(msg);
            qmsg.taskid = Number(qmsg.taskid);
            if (qmsg.cmd !== undefined) {
                switch (qmsg.cmd) {
                    case CmdNames.WHERE_IS_CTRL:
                        let rmsg = JAMP.createHereIsCtrl(that.jamsys.mqtt.server, parseInt(that.jamsys.mqtt.port));
                        let data = cbor.encode(rmsg);
                        sender.send(data, 0, data.length, sport, multicast_addr);
                    break;
                    case CmdNames.PROBE_REGISTER:
                        if (qmsg.app === cmdo.app) {
                            that.jcore.startProbeManager(qmsg.port);
                            rmsg = {cmd: CmdNames.PROBE_ACK};
                            let data = cbor.encode(rmsg);
                            sender.send(data, 0, data.length, sport, multicast_addr);
                        }
                    break;
                }
            }
        });
    }

    makeServer(id, ip, port) {
        let server = {};
        server.id = id;
        server.info = {ip: ip, port: port};
        server.idCount = this.actIDCounter++;
        server.popularity = this.actIDCounter;          // popularity = age by default
        server.serv = helper.mqttConnect(ip, port);
        return server;
    }

    getNcache(j) {
        if (this.ncache === undefined) {
            this.ncache = new NodeCache(j);
        }
        return this.ncache;
    }

    registerFuncs(machbox) {
        machbox.forEach((val, key) => {
            this.registerCallback(key, null, val.arg_sig, val.tasktype, val.results, val.reuse, val.cond);
        });
    }

    registerCallback(name, fk, mask, se, res, re, cnd) {
        if (name === "" || name === undefined) {
            console.log("Anonymous functions cannot be callbacks... request ignored");
            return;
        }
        if (this.funcRegistry.has(name)) {
            console.log("Duplicate registration: " + name + ".. overwritten.");
        }
        this.funcRegistry.set(name, {func: fk, arg_sig: mask, sideeff: se, results: res, reuse: re, cond: cnd});
    }
    
    findFunctionEntry(name) {
        if (name === undefined)
            return undefined;
        let fentry = this.funcRegistry.get(name);
        if (fentry === undefined)
            return fentry;
        else 
            return {name: name, func: fentry.fk, arg_sig: fentry.arg_sig, sideeff: fentry.sideeff, results: fentry.results, reuse: fentry.reuse, cond: fentry.cond}
    }

    processWorkerAck(id, msg) {
        let ientry = this.itaskq.get(id);
        if (ientry !== undefined) {
            ientry.callback(INQ_States.STARTED, msg)
        }
    }

    processWorkerError(id, msg) {
        let ientry = this.itaskq.get(id);
        if (ientry !== undefined) {
            ientry.callback(INQ_States.ERROR, msg)
        }
    }

    // For now.. we are just using a copy of the above method.. 
    processWorkerNak(id, msg) {
        let ientry = this.itaskq.get(id);
        if (ientry !== undefined) {
            ientry.callback(INQ_States.ERROR, msg)
        }
    }

    processWorkerResults(id, data) {
        let ientry = this.itaskq.get(id);
        if (ientry !== undefined) {
            ientry.state = INQ_States.COMPLETED;
            ientry.results = data;
            ientry.callback(INQ_States.COMPLETED, data)
        }
    }

    updateLocation(loc) {
        if (this.jamsys.machtype === 'fog') {
            this.jamsys.setLoc(loc);
            if (distanceBetweenLocs(loc, oldLoc) > minFogLocVariation) {
                oldLoc = loc;
                this.reggie.removeAttributes(['curLoc']);
                this.reggie.addAttributes({curLoc: loc});
            }
        } else if (this.jamsys.machtype === 'device') {
            this.jamsys.setLoc(loc);
            if (distanceBetweenLocs(loc, oldLoc) > minDevLocVariation) {
                oldLoc = loc;
                this.ncache.devChanged();
            }
        }
    }

    updateRedis(info) {
        if (this.jamsys.machtype === 'fog') {
            this.jamsys.reggie.removeAttributes(['dataDepot']);
            this.jamsys.reggie.addAttributes({dataDepot: info});
        }
    }

    hoistFog(cmd, info) {
        let temp_fog_count = 0;
        let fogids = [];
        let that = this;
        if (cmd === CmdNames.NORMAL) {
            // if we already found fogs.. and they are more than info.k, ignore the hoisting request
            if (this.ncache.getNumofFogs() > info.k)
                return;

            // do a test hoisting... of a temporary fog..
            let reg = new Registrar(cmdOpts.app, globals.NodeType.FOG, "tempfog-" + this.jamsys.id,
            cmdOpts.port, {long: cmdOpts.long, lat: cmdOpts.lat}, { protocols: cmdOpts.protocols });
            reg.registerAndDiscover();
            ebus.on('temp_fog', function(id) {
                temp_fog_count++;
                fogids.push(id);
            });
            // get the responses...
            setTimeout(()=> {
                reg.close();
                if ((temp_fog_count <= info.k) ||
                     select_fogs("tempfog-" + that.jamsys.id, fogids))
                {
                    let controller = new AbortController();
                    const {signal} = controller;
                    const child = exec(`jamrun_epm --app=${this.jamsys.app}`, {signal}, (error) => {
                        console.log(error);
                    });

                    setTimeout(()=> {
                        controller.abort();
                    }, 30000);
                }
            }, 1000);

        } else {
            // Just hoist the fog, we are forced to hoist the fog
            let controller = new AbortController();
            const {signal} = controller;
            const child = exec(`jamrun_epm --app=${this.jamsys.app}`, {signal}, (error) => {
                console.log(error);
            });

            setTimeout(()=> {
                controller.abort();
            }, info.lifetime);
        }
    }
}

module.exports = JAMCore;

function distanceBetweenLocs(loc, oloc) {
    return (loc.long - oloc.long) * (loc.long - oloc.long) + (loc.lat - oloc.lat) * (loc.lat - oloc.lat);
}

async function messageProcessor(jcore, sock, topic, msg) {
    let rmsg = undefined;
    switch (topic) {
        case '/' + cmdOpts.app + '/requests/up':
            // the commands are processed with most likely one first..
            if ((msg.cmd > CmdNames.EXEC_CMDS_BEG) && (msg.cmd < CmdNames.EXEC_CMDS_END)) {
                rmsg = await jcore.jdaemon.requestProcessor(msg);      
                sock.publish('/' + cmdOpts.app + '/replies/down', cbor.encode(rmsg));
                if (rmsg.cmd === CmdNames.MEXEC_ACK || rmsg.cmd === CmdNames.REXEC_ACK) {
                    let res = await jcore.jdaemon.checkExecResults(rmsg.taskid);
                    let fmsg = rmsg;
                    fmsg.args = [res];
                    if (rmsg.cmd === CmdNames.REXEC_ACK)
                        fmsg.cmd = CmdNames.REXEC_RES;
                    else 
                        fmsg.cmd = CmdNames.MEXEC_RES;
                    sock.publish('/' + cmdOpts.app + '/replies/down', cbor.encode(fmsg));
                }
            } else if ((msg.cmd > CmdNames.CONTROL_CMDS_BEG) && (msg.cmd < CmdNames.CONTROL_CMDS_END)) {
                jcore.jadmin.adminProcessor(msg, function (rmsg) {
                    sock.publish('/' + cmdOpts.app + '/announce/down', cbor.encode(rmsg));
                });
            } else if ((msg.cmd > CmdNames.SCHEDULE_CMDS_BEG) && (msg.cmd < CmdNames.SCHEDULE_CMDS_END)) {
                rmsg = await jcore.jdaemon.scheduleProcessor(msg);
                sock.publish('/' + cmdOpts.app + '/replies/down', cbor.encode(rmsg));
            } else if ((msg.cmd > CmdNames.PROBING_CMDS_BEG) && (msg.cmd < CmdNames.PROBING_CMDS_END)) {
                rmsg = await jcore.jdaemon.probeProcessor(msg);
                sock.publish('/' + cmdOpts.app + '/announce/down', cbor.encode(rmsg));
            }
        break;
        case '/' + cmdOpts.app + '/replies/up':
            rmsg = await jcore.jdaemon.replyProcessor(msg);
            if (rmsg !== undefined && rmsg.cmd === CmdNames.REXEC_SGO) 
                sock.publish('/' + cmdOpts.app + '/requests/down/c', cbor.encode(rmsg));
        break;
    }
    return true;
}

async function auxmessageProcessor(jcore, sock, topic, msg) {
    let rmsg = undefined;
    switch (topic) {
        case '/' + cmdOpts.app + '/requests/down/j':
            rmsg = await jcore.jdaemon.requestProcessor(msg);
            if (rmsg !== undefined) {
                sock.publish('/' + cmdOpts.app + '/replies/up', cbor.encode(rmsg));
                if (rmsg.cmd === CmdNames.REXEC_ACK || rmsg.cmd === CmdNames.MEXEC_ACK) {
                    let res = await jcore.jdaemon.checkExecResults(rmsg.taskid);
                    let fmsg = rmsg;
                    fmsg.data = res;
                    if (rmsg.cmd === CmdNames.REXEC_ACK)
                        fmsg.cmd = CmdNames.REXEC_RES;
                    else 
                        fmsg.cmd = CmdNames.MEXEC_RES;
                    sock.publish('/' + cmdOpts.app + '/replies/up', cbor.encode(fmsg));
                }
            }
        break;
        case '/' + cmdOpts.app + '/replies/down':
            rmsg = await jcore.jdaemon.replyProcessor(msg);
            if (rmsg !== undefined && rmsg.cmd === CmdNames.REXEC_SGO) 
                sock.publish('/' + cmdOpts.app + '/requests/up', cbor.encode(rmsg));
        break;
    }
}


// TODO: Execution interface : prediction cache, JCond 



// FIXME: Replies/up is meant to process SY aggreements? In the new protocol we are going to do this
// differently??
