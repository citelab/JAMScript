'use strict';

const constants = require('../utils/constants');

const   deviceParams = require('../utils/deviceparams'),
        globals = require('../utils/constants').globals,
        CmdNames = require('../utils/constants').CmdNames,
        ebus = require('../core/ebus'),
        helper = require('../utils/helper'),
        JAMP = require('../utils/jamprotocol'),
        log = require('../utils/jerrlog');

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
        // Global Policy Helpers TODO: move this stuff into nodecache
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

        // TODO: move this stuff into nodecache
        const getTheClosestLocalRegistry = function (localRegistriesMap, selfLocation) {
            let result = {
                localRegistryId: undefined,
                localRegistryInfo: undefined
            };
            log.info(JSON.stringify(localRegistriesMap) + "  " + localRegistriesMap.size);
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
            console.log("Fog Up.....", id, info);
            if (id.startsWith("tempfog-")) {
                ebus.emitMsg('temp_fog', id);
                return;
            }

            console.log("Fog UP... ", id, info);
            let fog = that.jcore.makeServer(id, info.ip, info.port, constants.globals.NodeType.FOG);
            that.jcore.fogs.push(fog);
            that.jcore.startAuxProcessors(fog);
            ebus.fogUp(id, info);
        }

        const fogDownJCoreAction = function(id) {
            let fog = findTheDownFog(that.jcore.fogs, id);
            log.info("Fog Down... ", id);
            if (fog !== undefined) {
                // delete the fog from the array after closing it.

                that.jcore.reggie.disconnectFromNode(id);

                that.jcore.fogs = arrayRemove(that.jcore.fogs, fog);;
                ebus.fogDown(id);
            }
        }

        const fogDataUpJCoreAction = function(id, info) {
            console.log("Fog Data Up....", id, info);
            that.jcore.enqueueJob({cmd: CmdNames.REDIS_STATE, opt: CmdNames.FOG_DATA_UP, data: {id: id, info: info}});
            ebus.fogDataUp(id, info);
        }

        const fogDataDownJCoreAction = function(id) {
            log.info("Data down....", id);
            that.jcore.enqueueJob({cmd: CmdNames.REDIS_STATE, opt: CmdNames.FOG_DATA_DOWN, data: {id: id}});
            ebus.fogDataDown(id);
        }

        const cloudUpJCoreAction = function(id, info) {
            log.info("-------------------------------  Cloud Up..");
            if (that.jcore.jamsys.machtype === globals.NodeType.FOG) {
                let cloud = that.jcore.makeServer(id, info.ip, info.port, constants.globals.NodeType.CLOUD, 'none');
                that.jcore.cloud = cloud;
                that.jcore.startAuxProcessors(cloud);
            }
            ebus.cloudUp(id, info);
        }

        const cloudDownJCoreAction = function(id) {
            let cloud = findTheCloud(that.jcore.cloud, id);
            if (cloud !== undefined) {
                that.jcore.reggie.disconnectFromNode(id);
                ebus.cloudDown(that.jcore.cloud.id, that.jcore.cloud.info);
            }
        }

        const cloudDataUpJCoreAction = function(id, info) {
        // TODO: Fill in
        }

        const cloudDataDownJCoreAction = function(id) {
        // TODO: Fill in 
        }


        this.jcore.ncache.onFogUpJCoreAction(fogUpJCoreAction);
        this.jcore.ncache.onFogDownJCoreAction(fogDownJCoreAction);
        this.jcore.ncache.onCloudUpJCoreAction(cloudUpJCoreAction);
        this.jcore.ncache.onCloudDownJCoreAction(cloudDownJCoreAction);

        this.jcore.ncache.onFogDataUpJCoreAction(fogDataUpJCoreAction);
        this.jcore.ncache.onFogDataDownJCoreAction(fogDataDownJCoreAction);
	
        this.jcore.ncache.onCloudDataUpJCoreAction(cloudDataUpJCoreAction);
        this.jcore.ncache.onCloudDataDownJCoreAction(cloudDataDownJCoreAction);


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
    async *adminProcessor(msg) {
        switch (msg['cmd']) {
            //[cmd: REGISTER, subcmd: NEW_REG/OLD_REG, args: device_id(string)]
            case constants.CmdNames.REGISTER:
                yield await this.__registerNode(msg);
            break;
            case constants.CmdNames.REF_CLOUD_FOG_INFO:
                yield await this.__refreshCloudFogInfo(msg);
            break;
            case constants.CmdNames.GET_CLOUD_FOG_INFO:
                yield await this.__getCloudFogInfo(msg);
            break;
            case constants.CmdNames.PONG:
                yield await this.__processPong(msg);
            break;
            default:
                log.warn('AdminProcessor:: UNKNOWN CMD: ' + msg['cmd'] + ' received.. ');
                throw('UNKNOWN COMMAND requested at adminProcessor');
        }
        return {cmd: CmdNames.DONE};
    }

    // Internal methods
    async __registerNode(msg) {
        let rdevid = msg['id'];
        msg['cmd'] = constants.CmdNames.REGISTER_ACK;
        msg['ctrlid'] = [deviceParams.getItem('deviceId')];
        if (!this.devTable.has(rdevid)) {
            msg['flag'] =  true;
            this.devTable.set(rdevid, {time: Date.now(), tag: "none"});
        } else
            msg['flag'] = false;
        return msg;
    }

    async __refreshCloudFogInfo(msg) {
        let rdevid = msg['id'];
        let drecord = this.devTable.get(rdevid);
        if (drecord !== undefined && drecord.tag === "registered")
            ebus.trigger();
        return {cmd: CmdNames.DONE};
    }

    async __getCloudFogInfo(msg, callback) {
        let that = this;
        return new Promise((resolve, reject) => {
            if (this.jcore.jamsys.machtype === globals.NodeType.DEVICE) {
                let rdevid = msg['id'];
                let drecord = this.devTable.get(rdevid);
                if (drecord !== undefined && drecord.tag === "none") {
                    drecord.tag = "registered";
                    ebus.on('fog_up', function(fogId, connInfo) {
                        console.log("FOg up....", fogId, connInfo);
                        let rmsg = JAMP.createFogAdditionPCFI(fogId, connInfo.ip, connInfo.port);
                        resolve(rmsg);
                        /*let redis = that.jcore.ncache.getFogData(fogId);
                        if (redis !== null) {
                            let rmsg = JAMP.createFogDataAddInfo(fogId, redis);
                            callback(rmsg);
                        }*/
                    });
                    ebus.on('fog_down', function(id) {
                        let rmsg = JAMP.createFogDeletionPCFI(id);
                        resolve(rmsg);
                    });

                    ebus.on('fog_data_up', function(id, dInfo) {
                        console.log("----------------- Fog Data Up...", id, dInfo);
                        let rmsg = JAMP.createFogDataAddInfo(id, dInfo);
                        resolve(rmsg);
                    });

                    ebus.on('fog_data_down', function(id) {
                        let rmsg = JAMP.createFogDataDelInfo(id);
                        resolve(rmsg);
                    });

                    ebus.on('cloud_up', function(cloudId, connInfo) {
                        let rmsg = JAMP.createCloudAdditionPCFI(cloudId, connInfo.ip, connInfo.port);
                        resolve(rmsg);
                    });
                    ebus.on('cloud_down', function(id) {
                        let rmsg = JAMP.createCloudDeletionPCFI(id);
                        resolve(rmsg);
                    });

                    ebus.on('cloud_data_up', function(id, dInfo) {
                        let rmsg = JAMP.createCloudDataAddInfo(id, dInfo);
                        resolve(rmsg);
                    });

                    ebus.on('cloud_data_down', function(id) {
                        let rmsg = JAMP.createCloudDataDelInfo(id);
                        resolve(rmsg);
                    });

                }
                ebus.trigger();
            }
        });
    }
    
    async __processPong(msg) {
        return {cmd: CmdNames.DONE}
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
module.exports = JCoreAdmin;

// TODO: Complete this file by addressing the following tasks
// Complete __processPong
// __getCloudFogInfo... complete that...
// Check whether adminProcessor is doing the correct functions and all of them.
// Check how the multiple fogs are handled..
