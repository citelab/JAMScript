'use strict';

const constants = require('../utils/constants');

const   deviceParams = require('../utils/deviceparams'),
        globals = require('../utils/constants').globals,
        CmdNames = require('../utils/constants').CmdNames,
        ebus = require('../core/ebus'),
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
        let that = this;
        /*
         * A a new fog has been selected for connection by the NodeCache's fog selector. 
         */
        this.jcore.ncache.onFogUp(function(id, info) {
            let fog = that.jcore.makeServer(id, info.ip, info.port);
            that.jcore.fogs.push(fog);
            that.jcore.startAuxProcessors(fog.serv);
            ebus.fogUp(id, info);
        });
        /*
         * We are receiving the 'fog down' event from the NodeCache. This should not be
         * a random event, it should be for the fog that is actually connected to this
         * device. However, we want to check that it is a relevant fog down message and then
         * do a proper disconnection from that fog.
         */
        this.jcore.ncache.onFogDown(function(id, info) {
            let fog = findTheDownFog(that.jcore.fogs, id);
            if (fog !== undefined) {
                that.jcore.fogs = closeTheFog(that.jcore.fogs, fog);
                ebus.fogDown(id, info);
            }
        });

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

        /*
         * This is the 'cloud up' event notification from the NodeCache. We do the same 
         * processing as the 'fog up' event.
         */
        this.jcore.ncache.onCloudUp(function(id, info) {
            if (that.jcore.jamsys.machtype === globals.NodeType.FOG) {
                let cloud = that.jcore.makeServer(id, info.ip, info.port);
                that.jcore.cloud = cloud;
                that.jcore.startAuxProcessors(cloud.serv);
            }
            ebus.cloudUp(id, info);
        });

        /*
         * Cloud down event processing.
         */
        this.jcore.ncache.onCloudDown(function(id, info) {
            let cloud = findTheCloud(that.jcore.cloud, id);
            if (cloud !== undefined) {
                closeTheCloud(cloud);
                ebus.cloudDown(that.jcore.cloud.id, that.jcore.cloud.info);
            }
        });

        this.jcore.ncache.onCloudDataUp(function(id, info) {
            that.jcore.enqueueJob({cmd: CmdNames.REDIS_STATE, opt: CmdNames.CLOUD_DATA_UP, data: info});
            ebus.cloudDataUp(id, info);
        });

        this.jcore.ncache.onCloudDataDown(function(id) {
            that.jcore.enqueueJob({cmd: CmdNames.REDIS_STATE, opt: CmdNames.CLOUD_DATA_DOWN});
            ebus.cloudDataDown(id);
        });

        /*
         * The event handlers above were specifying the actions that needs to be taken when the NodeCache 
         * calls back with a specific event. For the NodeCache to function, it needs input. We are routing the 
         * events triggered by the jdiscovery (reggie) to the NodeCache. The NodeCache is sanitizing these events 
         * (like duplicate elimination, etc) and then it calls back the program. The NodeCache also runs some
         * selection algorithms. 
         */
        if (this.jcore.jamsys.machtype === globals.NodeType.DEVICE) {
            this.jcore.jamsys.reggie.on('fog-up', function(id, info) {
                if (id.startsWith("tempfog-"))
                    ebus.emitMsg('temp_fog', id);
                else 
                    that.jcore.ncache.fogUp(id, info);
            });
            this.jcore.jamsys.reggie.on('fog-down', function(id) {
                if (!id.startsWith("tempfog-"))
                    that.jcore.ncache.fogDown(id);
            });
            this.jcore.jamsys.reggie.on('cloud-up', function(id, info) {
                that.jcore.ncache.cloudUp(id, info);
            });
            this.jcore.jamsys.reggie.on('cloud-down', function(id) {
                that.jcore.ncache.cloudDown(id);
            });
            this.jcore.jamsys.reggie.on('new-loc', function(id, loc) {
                that.jcore.ncache.fogChanged(id, loc);
            });
            this.jcore.jamsys.reggie.on('new-datadepot', function(id, redis) {
                that.jcore.ncache.fogDataUp(id, redis);
            });
            this.jcore.jamsys.reggie.on('datadepot-removed', function(id) {
                that.jcore.ncache.fogDataDown(id);
            });
        } else if (that.jcore.jamsys.machtype === globals.NodeType.FOG) {
            this.jcore.jamsys.reggie.on('cloud-up', function(id, info) {
                that.jcore.ncache.cloudUp(id, info);
            });
            this.jcore.jamsys.reggie.on('cloud-down', function(id) {
                that.jcore.ncache.cloudDown(id);
            });
            this.jcore.jamsys.reggie.on('new-datadepot', function(id, redis) {
                that.jcore.ncache.cloudDataUp(id, redis);
            });
            this.jcore.jamsys.reggie.on('datadepot-removed', function(id) {
                that.jcore.ncache.cloudDataDown(id);
            });
        }
        /*
         * kick-start registration and discovery
         */
        this.jcore.jamsys.reggie.registerAndDiscover();
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
