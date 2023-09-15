'use strict';

const constants = require('../utils/constants');

const   deviceParams = require('../utils/deviceparams'),
        globals = require('../utils/constants').globals,
        CmdNames = require('../utils/constants').CmdNames,
        cmdOpts = require('../utils/cmdparser'),
        cbor = require('cbor-x'),
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
        this.devSet = new Set();
        this.devSetSize = 0;

        setInterval(()=> {
            this.devSetSize = this.devSet.size;
            this.devSet.clear();
        }, globals.Timeouts.PING_DURATION * 5);
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

    async infoProcessor(sock) {
        // this never resolves...
        console.log("############### infoProcessor ########## ");
        return new Promise((resolve, reject) => {
            this.fogInfoProcessor(sock);
            this.fogDataInfoProcessor(sock);
        });
    }

    async registerProcessor(sock, msg) {
        let rdevid = msg['nodeid'];
        if (rdevid !== undefined) {
            this.devSet.add(rdevid);
            let rmsg = JAMP.createRegisterAck(this.jcore.jamsys.id);
            sock.publish('/' + cmdOpts.app + '/announce/down', cbor.encode(rmsg));
        }
    }

    async fogInfoProcessor(sock) {
        console.log("Running fogInfoProcessor...................");
        while(1) {
            let rmsg = await this.__getFogInfo();
            sock.publish('/' + cmdOpts.app + '/announce/down', cbor.encode(rmsg));
        }
    }

    async fogDataInfoProcessor(sock) {
        while(1) {
            let rmsg = await this.__getFogDataInfo();
            sock.publish('/' + cmdOpts.app + '/announce/down', cbor.encode(rmsg));
        }
    }    

    async __getFogInfo() {
        console.log(">>>>>>>>>>>>> getFogInfo.......");
        return new Promise((resolve, reject) => {
            if (this.jcore.jamsys.machtype === globals.NodeType.DEVICE) {
                ebus.on('fog_up', function(fogId, connInfo) {
                    console.log("getCloudFogInfo ... FOg up....", fogId, connInfo);
                    let rmsg = JAMP.createFogAdditionPCFI(fogId, connInfo.ip, connInfo.port);
                    resolve(rmsg);
                });
                ebus.on('fog_down', function(id) {
                    let rmsg = JAMP.createFogDeletionPCFI(id);
                    resolve(rmsg);
                });
            }
            ebus.trigger();
        });
    }

    async __getFogDataInfo() {
        return new Promise((resolve, reject) => {
            if (this.jcore.jamsys.machtype === globals.NodeType.DEVICE) {
                ebus.on('fog_data_up', function(id, dInfo) {
                    console.log("----------------- Fog Data Up...", id, dInfo);
                    let rmsg = JAMP.createFogDataAddInfo(id, dInfo);
                    resolve(rmsg);
                });
                ebus.on('fog_data_down', function(id) {
                    let rmsg = JAMP.createFogDataDelInfo(id);
                    resolve(rmsg);
                });
            }
            ebus.trigger();
        });
    }

    async processPong(msg) {
        this.devSet.add(msg.nodeid);
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

// __getCloudFogInfo... complete that...
// Check whether adminProcessor is doing the correct functions and all of them.
// Check how the multiple fogs are handled..
