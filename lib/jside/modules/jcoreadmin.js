'use strict';

const constants = require('../utils/constants');

const   deviceParams = require('../utils/deviceparams'),
        globals = require('../utils/constants').globals,
        CmdNames = require('../utils/constants').CmdNames,
        ebus = require('../core/ebus'),
        helper = require('../utils/helper'),
        JAMP = require('../utils/jamprotocol');

class JCoreAdmin {
    constructor(jc) {
        if (JCoreAdmin.this)
            return JCoreAdmin.this;
        JCoreAdmin.this = this;
        this.jcore = jc;
        this.devTable = new Map();
    }

    /*
     * Here we are setting up the registration event handlers so that the node remains 
     * connected properly as changes in topology happens at the device-fog and fog-cloud 
     * boundaries.
     */
    doRegister() {
        // Global Policy Helpers
        const getTheClosestFog = function (availableFogs, selfLocation) {
            let result = {
                fogId: undefined,
                fogInfo: undefined
            };
            let closestDistance = Number.MAX_SAFE_INTEGER;
            availableFogs.forEach((value, key) => {
            const fogLocation = value["loc"];
            const trialDistance = helper.geo2Distance(
                fogLocation.long,
                fogLocation.lat,
                selfLocation.long,
                selfLocation.lat
            );
        
            if (trialDistance < closestDistance) {
                result = {
                    fogInfo: value,
                    fogId: key,
                };
                closestDistance = trialDistance;
            }
            });
        
            return result;
        };

        const getTheClosestLocalRegistry = function (localRegistriesMap, selfLocation) {
            let result = {
                localRegistryId: undefined,
                localRegistryInfo: undefined
            };
            let closestDistance = Number.MAX_SAFE_INTEGER;
            localRegistriesMap.forEach((value, key) => {
            const localRegistryLocation = value["loc"];
            const trialDistance = helper.geo2Distance(
                localRegistryLocation.long,
                localRegistryLocation.lat,
                selfLocation.long,
                selfLocation.lat
            );
        
            if (trialDistance < closestDistance) {
                result = {
                    localRegistryId: key,
                    localRegistryInfo: value,
                };
                closestDistance = trialDistance;
            }
            });
        
            return result;
        };

        const getTheConnectedFog = function(connectedFogs) {
            let result;
            connectedFogs.forEach((value, key) => {
                result = {
                    fogId: key,
                    fogInfo: value
                };
            });
            return result;
        }

        let that = this;

        const fogUpJCoreAction = function(id, info) {
            console.log("Fog UP... ", id, info);
            let fog = that.jcore.makeServer(id, info.ip, info.port);
            that.jcore.fogs.push(fog);
            that.jcore.startAuxProcessors(fog.serv);
            ebus.fogUp(id, info);
        }

        const fogDownJCoreAction = function(id) {
            let fog = findTheDownFog(that.jcore.fogs, id);
            if (fog !== undefined) {
                that.jcore.fogs = closeTheFog(that.jcore.fogs, fog);
                ebus.fogDown(id);
            } 
        }
// TODO: this likely needs to be changed to fit in with modern node-cache
        this.jcore.ncache.onFogDataUp(function(id, info) {
            that.jcore.enqueueJob({cmd: CmdNames.REDIS_STATE, opt: CmdNames.FOG_DATA_UP, data: {id: id, info: info}});
            console.log("---------- calling fogDataUp....");
            ebus.fogDataUp(id, info);
        });

        this.jcore.ncache.onFogDataDown(function(id) {
            console.log("Data down....", id);
            that.jcore.enqueueJob({cmd: CmdNames.REDIS_STATE, opt: CmdNames.FOG_DATA_DOWN, data: {id: id}});
            ebus.fogDataDown(id);
        });

        const cloudUpJCoreAction = function(id, info) {
            console.log("Cloud Up..");
            if (that.jcore.jamsys.machtype === globals.NodeType.FOG) {
                let cloud = that.jcore.makeServer(id, info.ip, info.port);
                that.jcore.cloud = cloud;
                that.jcore.startAuxProcessors(cloud.serv);
            }
            ebus.cloudUp(id, info);
        }

        const cloudDownJCoreAction = function(id) {
            let cloud = findTheCloud(that.jcore.cloud, id);
            if (cloud !== undefined) {
                closeTheCloud(cloud);
                ebus.cloudDown(that.jcore.cloud.id, that.jcore.cloud.info);
            }
        }

        this.jcore.ncache.onFogUpJCoreAction(fogUpJCoreAction);
        this.jcore.ncache.onFogDownJCoreAction(fogDownJCoreAction);
        this.jcore.ncache.onCloudUpJCoreAction(cloudUpJCoreAction);
        this.jcore.ncache.onCloudDownJCoreAction(cloudDownJCoreAction);

        /*
         * The event handlers above were specifying the actions that needs to be taken when the NodeCache 
         * calls back with a specific event. For the NodeCache to function, it needs input. We are routing the 
         * events triggered by the jdiscovery (reggie) to the NodeCache. The NodeCache is sanitizing these events 
         * (like duplicate elimination, etc) and then it calls back the program. The NodeCache also runs some
         * selection algorithms. 
         */
        if (this.jcore.jamsys.machtype === globals.NodeType.DEVICE) {
            this.jcore.ncache.onFogUp(function(id, info, {
                localRegistriesMap,
                availableFogs,
                connectedFogs,
                connectedFogsAndDevices,
            }) {
                if (connectedFogs.size !== 0) 
                    return;
                that.jcore.ncache.reggie.connectToNewFog(id);
                that.jcore.ncache.fuhandler(id, info);
                return;
            });
    
            this.jcore.ncache.onConnectedClientDown(function(nodeId,
                clientUrl,
                clientType, {
                localRegistriesMap,
                availableFogs,
                connectedFogs,
                connectedFogsAndDevices,
            }) {
                if (clientType === constants.globals.NodeType.FOG) {
                    const { fogId, fogInfo } = getTheClosestFog(availableFogs, that.jcore.ncache.location);
                    if (fogId !== undefined) {
                        that.jcore.ncache.reggie.connectToNewFog(fogId);
                        that.jcore.ncache.fuhandler(fogId, fogInfo);
                    }
                }
            });

            this.jcore.ncache.onCustomEvent('new-loc', function(id, info, {
                localRegistriesMap,
                availableFogs,
                connectedFogs,
                connectedFogsAndDevices,
            }) {
                if (connectedFogs.size === 0) {
                    const { fogId, fogInfo } = getTheClosestFog(availableFogs, that.jcore.ncache.location);
                    if (fogId !== undefined) {
                        that.jcore.ncache.reggie.connectToNewFog(fogId);
                        that.jcore.ncache.fuhandler(fogId, fogInfo);
                    } 
                } else {
                    const { connectedFogId, connectedFogInfo } = getTheConnectedFog(connectedFogs);
                    const { closestFogId, closestFogInfo } = getTheClosestFog(availableFogs);
                    if (closestFogId !== connectedFogId) {
                        that.jcore.ncache.fdhandler(connectedFogId);
                        that.jcore.ncache.reggie.disconnectFromFog(connectedFogId);
                        that.jcore.ncache.reggie.connectToNewFog(closestFogId);
                        that.jcore.ncache.fuhandler(closestFogId, closestFogInfo);
                    }
                }
            });
        } 

        if (this.jcore.jamsys.machtype === globals.NodeType.DEVICE || this.jcore.jamsys.machtype === globals.NodeType.FOG) {
            this.jcore.ncache.onSelectLocalRegistryAtBootstrapping(getTheClosestLocalRegistry);
        }

        /*
         * kick-start registration and discovery
         */
        this.jcore.ncache.init();
    }

    /*
     * The following method is responsible for handling the interactions with the C devices.
     * We need to handle registrations, information pushing (data store, fog, and cloud changes) 
     * to the C node. 
     */
    async adminProcessor(msg, callback) {
        switch (msg['cmd']) {
            //[cmd: REGISTER, subcmd: NEW_REG/OLD_REG, args: device_id(string)]
            case constants.CmdNames.REGISTER:
                this.__registerNode(msg, callback);
            break;
            case constants.CmdNames.REF_CLOUD_FOG_INFO:
                return this.__refreshCloudFogInfo(msg);
            break;
            case constants.CmdNames.GET_CLOUD_FOG_INFO:
                return this.__getCloudFogInfo(msg, callback);
            break;
            case constants.CmdNames.PONG:
                return this.__processPong(msg);
            break;
            default:
                console.log('AdminProcessor:: UNKNOWN CMD: ' + msg['cmd'] + ' received.. ');
                throw('UNKNOWN COMMAND requested at adminProcessor');
        }
    }

    // Internal methods
    __registerNode(msg, callback) {
        var rdevid = msg['id'];
        msg['cmd'] = constants.CmdNames.REGISTER_ACK;
        msg['ctrlid'] = [deviceParams.getItem('deviceId')];
        if (!this.devTable.has(rdevid)) {
            msg['flag'] =  true;
            this.devTable.set(rdevid, {time: Date.now(), tag: "none"});
        } else 
            msg['flag'] = false;
        callback(msg);
    }

    __refreshCloudFogInfo(msg) {
        var rdevid = msg['id'];
        var drecord = this.devTable.get(rdevid);
        if (drecord !== undefined && drecord.tag === "registered")
            ebus.trigger();
    }

    __getCloudFogInfo(msg, callback) {
        var that = this;
        if (this.jcore.jamsys.machtype === globals.NodeType.DEVICE) {
            var rdevid = msg['id'];
            var drecord = this.devTable.get(rdevid);
            if (drecord !== undefined && drecord.tag === "none") {
                drecord.tag = "registered";
                ebus.on('fog_up', function(fogId, connInfo) {
                    var rmsg = JAMP.createFogAdditionPCFI(fogId, connInfo.ip, connInfo.port);
                    callback(rmsg);
                });
                ebus.on('fog_down', function(id) {
                    var rmsg = JAMP.createFogDeletionPCFI(id);
                    callback(rmsg);
                });

                ebus.on('fog_data_up', function(id, dInfo) {
                    console.log("Fog Data UP received..", id, dInfo);
                });

                ebus.on('fog_data_down', function(id) {
                    console.log("Fog Data Down received..", id);
                });

                ebus.on('cloud_up', function(cloudId, connInfo) {
                    var rmsg = JAMP.createCloudAdditionPCFI(cloudId, connInfo.ip, connInfo.port);
                    callback(rmsg);
                });
                ebus.on('cloud_down', function(id) {
                    var rmsg = JAMP.createCloudDeletionPCFI(id);
                    callback(rmsg);
                });

                ebus.on('cloud_data_up', function(id, dInfo) {
                    console.log("Cloud Data UP received..", id, dInfo);
                });

                ebus.on('cloud_data_down', function(id) {
                    console.log("Fog Data Down received..", id);
                });

            }
            ebus.trigger();
        }
    }
    __processPong(msg) {
    }
}

// return the fog to delete.. don't delete it yet
function fogToDelete(fogs, numFogs) {
    let minpop, elem;

    if (fogs.length < numFogs)
        return undefined;
    fogs.forEach((f)=> {
        if (minpop === undefined) {
            minpop = f.popularity;
            elem = f;
        } else if (minpop > f.popularity) {
            minpop = f.popularity;
            elem = f;
        }
    });
    return elem;
}

// delete the fog from the array after closing it.
function closeTheFog(fogs, delfog) {

    if (delfog.serv !== undefined) {
        delfog.serv.end(true);
        delfog.serv = undefined;
    }
    return arrayRemove(fogs, delfog);
}

function arrayRemove(arr, value) { 
    
    return arr.filter(function(ele){ 
        return ele != value; 
    });
}

// find the fog that is down..
function findTheDownFog(fogs, fid) {
    let fv;
    fogs.forEach((f)=> {
        if (f.id === fid) 
            fv = f;
    });
    return fv;
}

// find the fog that is down..
function findTheCloud(cloud, cid) {

    if (cloud !== undefined && cloud.id === cid) 
        return cloud;
    else 
        return undefined;
}

// close the cloud and delete it
function closeTheCloud(cloud) {

    if (cloud.serv !== undefined) {
        cloud.serv.end(true);
        cloud.serv = undefined;
    }
}


module.exports = JCoreAdmin;

// TODO: Complete this file by addressing the following tasks
// Complete __processPong
// __getCloudFogInfo... complete that...
// Check whether adminProcessor is doing the correct functions and all of them.
// Check how the multiple fogs are handled.. 
