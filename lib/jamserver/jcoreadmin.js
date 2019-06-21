'use strict';

const jsys = require('./jamsys');
const mqtt = require('mqtt');
const deviceParams = require('./deviceparams');
const globals = require('./constants').globals;
const mqttconsts = require('./constants').mqtt;
const ebus = require('./ebus');


class JCoreAdmin {

    constructor(jc) {
        // Only maintain a single instance of the JCoreAdmin
        if (JCoreAdmin.this)
            return JCoreAdmin.this;
        JCoreAdmin.this = this;

        this.jcore = jc;
        this.reggie = jc.reggie;
        this.machtype = jc.machtype;
        this.ncache = jc.ncache;
        this.devTable = new Map();
    }

    doRegister() {

        var that = this;
        // Setup the callback handlers for NodeCache to work
        // Handler to run to connect to a fog
        this.ncache.onFogUp(function(id, info) {

            console.log('------------FogUp------->>>>-------------------------');

            // fserv is not pointing to the current fog
            // it is undefined..
            if (that.jcore.fserv === null && id !== undefined && info !== undefined) {
                that.fid = id;
                console.log('--------------- |||Setting the fog...---------------');
                jsys.setFog(that.fid);
                var furl = getURL(info.ip, info.port);

                var copts = {
                            clientId: deviceParams.getItem('deviceId'),
                            keepalive: mqttconsts.keepAlive,
                            clean: false,
                            connectTimeout: mqttconsts.connectionTimeout,
                        };

                that.jcore.fserv = mqtt.connect(furl, copts);
                if (that.machtype === globals.NodeType.DEVICE)
                    deviceParams.setItem('parentId', furl);
                ebus.emitFogUp(that.fid, info);
                that.jcore.runnerSockConfig(that.jcore.fserv);
                that.ncache.setCurrentFog(that.fid);
            }
        });

        // Handler to run to disconnect from a fog
        this.ncache.onFogDown(function(id, info) {

            console.log('-----------------------<<<<---------------------');
            // fserv is pointing to the current fog server
            if (that.jcore.fserv !== undefined && id !== undefined && info !== undefined) {
                that.fid = undefined;
                if (that.jcore.fserv !== null) {
                    that.jcore.fserv.end(true);
                    that.jcore.fserv = null;
                }
                if (that.machtype === globals.NodeType.DEVICE)
                    deviceParams.setItem('parentId', '-');

                ebus.emitFogDown(id, info);
                jsys.unsetFog(id);
            }
        });

        // Hander to run to connect to a cloud
        this.ncache.onCloudUp(function(id, info) {

            console.log('------------------------>>>>>CCC>>>>--------------------');
            // cserv is not pointing to the current fog
            // it is undefined..
            if (that.jcore.cserv === null && id !== undefined && info !== undefined) {

                console.log("!!!!!!! cloud up.....");

                that.cid = id;
                var curl = getURL(info.ip, info.port);
                var copts = {
                            clientId: deviceParams.getItem('deviceId'),
                            keepalive: mqttconsts.keepAlive,
                            clean: false,
                            connectTimeout: mqttconsts.connectionTimeout,
                        };
                that.jcore.cserv = mqtt.connect(curl, copts);
                if (that.machtype === globals.NodeType.FOG)
                    deviceParams.setItem('parentId', curl);
                ebus.emitCloudUp(that.cid, info);
                that.jcore.runnerSockConfig(that.jcore.cserv);
                jsys.setCloud(that.cid);
                that.ncache.setCurrentCloud(that.cid);

            }
        });

        // Handler to run to disconnect from a cloud
        this.ncache.onCloudDown(function(id, info, callback) {

            console.log('------------------------<<<<CCCC<<<<--------------------');
            // cserv is pointing to the current fog server
            if (that.jcore.cserv !== null && id !== undefined && info !== undefined) {
                that.cid = undefined;
                if (that.jcore.cserv !== null) {
                    that.jcore.cserv.end(true);
                    that.jcore.cserv = null;
                }
                if (that.machtype === globals.NodeType.FOG)
                    deviceParams.setItem('parentId', '-');
                console.log("Cloud down....");
                ebus.emitCloudDown(id, info);
                jsys.unsetCloud(id);
            }
        });

        // Setup the reggie events - what the node does when advertisements come in
        //
        if (this.machtype === globals.NodeType.DEVICE) {
            this.reggie.on('fog-up', function(id, info) {
                console.log('>>> (doRegister) FOG UP: id: ' + id + ', ip: ' + info.ip + ', port: ' + info.port);
                // Update the node cache... cache does the rest
                that.ncache.fogUp(id, info);
            });

            this.reggie.on('fog-down', function(id) {
                console.log('>>> (doRegister) FOG DOWN: id: ' + id);
                // Mark the fog as down in the cache
                that.ncache.fogDown(id);
            });

            this.reggie.on('fog-datadepot-up', function(id, info) {
                console.log('1==================================================')
                that.ncache.fogDataUp(id, info);
            });

            this.reggie.on('cloud-up', function(id, info) {
                that.ncache.cloudUp(id, info);
            });

            this.reggie.on('cloud-down', function(id) {
                console.log('>>>(doRegister) CLOUD DOWN: id: ' + id);
                that.ncache.cloudDown(id);
            });
        } else if (that.machtype === globals.NodeType.FOG) {
            this.reggie.on('cloud-up', function(id, info) {
                console.log("Cloud...up received...");
                that.ncache.cloudUp(id, info);
            });

            this.reggie.on('cloud-datadepot-up', function(id, info) {
                that.ncache.cloudDataUp(id, info);
            });

            this.reggie.on('cloud-down', function(id) {
                that.ncache.cloudDown(id);
            });
        }

        // kick-start registration and discovery
        this.reggie.registerAndDiscover();
    }


    // The admin service handler..
    //
    // [[ REGISTER DEVICE app_name _ device_serial ]]
    // We are using UUID4 for device_serial. It is assumed to be universally unique (with collisions rare).
    // The broker will check the device_id in its table. If it is found in the table,
    // sends the following message to /admin/announce/all.
    // [[ REGISTER-ACK OLD broker_serial _ device_serial ]]
    // else sends the following
    // [[ REGISTER-ACK NEW broker_serial _ device_serial ]]
    adminService(msg, callback) {

        switch (msg['cmd']) {
            case 'REGISTER':
                var rdevid = msg['actarg'];
                msg['cmd'] = 'REGISTER-ACK';
                msg['actid'] = deviceParams.getItem('deviceId');
                // Changes
                this.jcore.cNodeCount++;
                if (!this.devTable.has(rdevid)) {
                    // Registration request is for a new device
                    msg['opt'] = 'NEW';
                    this.devTable.set(rdevid, {time: Date.now(), tag: "none"});
                    callback(msg);
                } else {
                    // Request for a devices already registered
                    msg['opt'] = 'OLD';
                    callback(msg);
                }
            break;
            case 'REF-CF-INFO':
                console.log("REF............");
                var rdevid = msg['actarg'];
                var drecord = this.devTable.get(rdevid);
                if (drecord !== undefined && drecord.tag === "registered")
                    ebus.trigger();
            break;
            case 'GET-CF-INFO':
                var rdevid = msg['actarg'];
                // Check whether we have already registered the callbacks.
                // If we don't do this.. we will end up getting many callbacks to a C
                // node and it will go crazy!
                var drecord = this.devTable.get(rdevid);
                if (drecord !== undefined && drecord.tag === "none") {
                    drecord.tag = "registered";
                } else {
                    break;
                }
                if (this.machtype === globals.NodeType.DEVICE) {
                    msg['cmd'] = 'PUT-CF-INFO';

                    ebus.on('fog-up', function(fogId, connInfo) {
                        console.log('(adminService) FOG UP: id: ' + fogId + ', ip: ' + connInfo.ip + ', port: ' + connInfo.port);
                        msg['opt'] = 'ADD';
                        msg['actarg'] = globals.NodeType.FOG;
                        msg['actid'] = fogId;
                        msg['args'] = [getURL(connInfo.ip, connInfo.port)];
                        callback(msg);
                    });
                    ebus.on('fog-down', function(id, info) {
                        console.log('(adminService) FOG DOWN: id: ' + id);
                        msg['opt'] = 'DEL';
                        msg['actarg'] = globals.NodeType.FOG;
                        msg['actid'] = id;
                        msg['args'] = [getURL(info.ip, info.port)];
                        console.log(msg);
                        callback(msg);
                    });
                    ebus.on('cloud-up', function(cloudId, connInfo) {
                        console.log('(adminService) CLOUD UP: id: ' + cloudId + ', ip: ' + connInfo.ip + ', port: ' + connInfo.port);
                        msg['opt'] = 'ADD';
                        msg['actarg'] = globals.NodeType.CLOUD;
                        msg['actid'] = cloudId;
                        msg['args'] = [getURL(connInfo.ip, connInfo.port)];
                        callback(msg);
                    });
                    ebus.on('cloud-down', function(id, info) {
                        console.log('(adminService) CLOUD DOWN: id: ' + id);
                        msg['opt'] = 'DEL';
                        msg['actarg'] = globals.NodeType.CLOUD;
                        msg['actid'] = id;
                        msg['args'] = [getURL(info.ip, info.port)];
                        callback(msg);
                    });
                    ebus.on('data-up', function(dinfo) {
                        msg['opt'] = 'ADD';
                        msg['actarg'] = 'redis';
                        msg['actid'] = '-';
                        msg['args'] = [dinfo.host, dinfo.port];
                        callback(msg);
                    });
                    console.log("-----------------EBus trigger........");
                    ebus.trigger();
                    var rinfo = jsys.getRedis();
                    if (rinfo !== undefined) {
                        msg['opt'] = 'ADD';
                        msg['actarg'] = 'redis';
                        msg['actid'] = '-';
                        msg['args'] = [rinfo.host, rinfo.port];
                        callback(msg);
                    }
                }
            break;
            default:
                console.log('AdminService:: UNKNOWN CMD: ' + msg['cmd'] + ' received.. ');
                throw('UNKNOWN COMMAND');
        }
    }
}

function getURL(ip, port) {
    return "tcp://" + ip + ":" + port;
}

module.exports = JCoreAdmin;
