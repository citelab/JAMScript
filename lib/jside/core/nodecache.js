'use strict';

/* 
 * This module implements the node cache.
 * When a fog or cloud becomes available we put it here. Same way
 * when a fog or cloud goes down. The nodeCache is responsible for
 * selecting the nodes to replace the down ones or the initial ones
 * to connect.
 */
const   helper = require('../utils/helper');

let     activefogs,
        otherfogs,
        clouds,
        jsys;

class NodeCache {
    constructor(jamsys) {
        activefogs = new Map();
        otherfogs = new Map();
        clouds = new Map();

        this.currentCloud;

        // number of fogs allowed for connection - we seek the best fogs
        this.numFogs = jamsys.edge; 
        jsys = jamsys;
    }

    // I am ignoring the otherfogs.. all necessary fogs must be loaded into activefogs
    getNumofFogs() {
        return activefogs.size;
    }

    onFogUp(handler) {
        this.fuhandler = handler;
    }

    onFogDown(handler) {
        this.fdhandler = handler;
    }

    onFogDataUp(handler) {
        this.fduhandler = handler;
    }

    onFogDataDown(handler) {
        this.fddhandler = handler;
    }

    onCloudUp(handler) {
        this.cuhandler = handler;
    }

    onCloudDown(handler) {
        this.cdhandler = handler;
    }

    onCloudDataUp(handler) {
        this.cduhandler = handler;
    }

    onCloudDataDown(handler) {
        this.cddhandler = handler;
    }

    fogUp(id, info) {
        // already part of the active fogs, nothing to do just return
        let fog = activefogs.get(id);
        if (fog !== undefined)
            return;

        let fogactivated = false;
        // if the number of active fogs is below the required threshold, we just activate the new one
        if (activefogs.size < this.numFogs) {
            activefogs.set(id, {key: id, val: info, redis: null});
            this.fuhandler(id, info);
            return;
        } else {
            let dist = distanceToFog(info);
            activefogs.forEach((rec, k)=> {
                let tdist = distanceToFog(rec.val);
                if (fogactivated === false && tdist > dist) {
                    this.fdhandler(rec.key, rec.val);
                    if (rec.redis !== null)
                        this.fddhandler(rec.key, rec.redis);
                    otherfogs.set(rec.key, {key: rec.key, val: rec.val, redis: rec.redis});
                    activefogs.delete(rec.key);
                    this.fuhandler(id, info);
                    activefogs.set(id, {key: id, val: info, redis: null});
                    fogactivated = true;
                }
            });
        }
        if (fogactivated === false)
            otherfogs.set(id, {key: id, val: info, redis: null});
    }

    fogChanged(id, newloc) {
        let fog = activefogs.get(id);
        if (fog !== undefined) {
            fog.val.loc = newloc;
            let fogactivated = false;
            let dist = distanceToFog(fog.val);
            // active fog moving out because there is a better other fog..
            otherfogs.forEach((rec, k) => {
                let odist = distanceToFog(rec.val);
                if (fogactivated === false && odist < dist) {
                    otherfogs.set(fog.key, {key: fog.key, val: fog.val, redis: fog.redis});
                    activefogs.set(rec.key, {key: rec.key, val: rec.val, redis: rec.redis});
                    this.fdhandler(id, fog.val);
                    if (fog.redis !== null)
                        this.fddhandler(id);
                    this.fuhandler(rec.key, rec.val);
                    if (rec.redis !== null)
                        this.fduhandler(rec.key, rec.redis);
                    otherfogs.delete(rec.key);
                    activefogs.delete(fog.key);
                    fogactivated = true;
                }
            });
        } else {
            let fog = otherfogs.get(id);
            if (fog !== undefined) {
                fog.val.loc = newloc;
                let fogactivated = false;
                let dist = distanceToFog(fog.val);
                // other fog moving in because it is better than active fogs..
                activefogs.forEach((rec, k) => {
                    let adist = distanceToFog(rec.val);
                    if (fogactivated === false && adist > dist) {
                        activefogs.set(id, {key: id, val: fog.val, redis: fog.redis});
                        otherfogs.set(rec.key, {key: rec.key, val: rec.val, redis: rec.redis});
                        this.fdhandler(rec.key, rec.val);
                        if (rec.redis !== null)
                            this.fddhandler(rec.key);
                        this.fuhandler(id, fog.val);
                        if (fog.redis !== null)
                            this.fduhandler(fog.key, fog.redis);
                        otherfogs.delete(id);
                        activefogs.delete(rec.key);
                        fogactivated = true;
                    }
                });
            }
        }
    }

    devChanged() {
        if (otherfogs.size === 0 || activefogs.size === 0)
            return;
        let mdist = 0;
        let mfog = null;
        activefogs.forEach((rec, k) => {
            let dist = distanceToFog(rec.val);
            if (dist > mdist) {
                mdist = dist;
                mfog = rec;
            }
        });
        let fogfound = false;
        otherfogs.forEach((rec, k) => {
            let dist = distanceToFog(rec.val);
            if (fogfound === false && dist < mdist) {
                activefogs.set(rec.key, {key: rec.key, val: rec.val, redis: rec.redis});
                otherfogs.set(mfog.key, {key: mfog.key, val: mfog.val, redis: mfog.redis});
                this.fdhandler(mfog.key, mfog.val);
                if (mfog.redis !== null)
                    this.fddhandler(mfog.key);
                this.fuhandler(rec.key, rec.val);
                if (rec.redis !== null)
                    this.fduhandler(rec.key, rec.redis);
                otherfogs.delete(rec.key);
                activefogs.delete(mfog.key);
                fogfound = true;
            }
        });
    }

    fogDown(id) {
        let fog = activefogs.get(id);
        if (fog !== undefined) {
            this.fdhandler(fog.key, fog.val);
            if (fog.redis !== null)
                this.fddhandler(fog.key);

            activefogs.delete(id);
            let fogreplaced = false;
            otherfogs.forEach((rec, k)=> {
                if (fogreplaced === false) {
                    this.fuhandler(rec.key, rec.val);
                    if (rec.redis !== null)
                        this.fduhandler(rec.key, rec.redis);
                    activefogs.set(rec.key, {key: rec.key, val: rec.val, redis: rec.redis});
                    fogreplaced = true;
                    otherfogs.delete(rec.key);
                }
            });
        } else 
            otherfogs.delete(id)
    }

    fogDataUp(id, info) {
        let fog = activefogs.get(id);
        if (fog !== undefined) {
            fog.redis = info;
            this.fduhandler(id, info);
        } else {
            let fog = otherfogs.get(id);
            if (fog !== undefined) 
                fog.redis = info;
        }
    }

    fogDataDown(id) {
        let fog = activefogs.get(id);
        if (fog !== undefined)
            this.fddhandler(id);
        else {
            let fog = otherfogs.get(id);
            if (fog !== undefined) 
                fog.redis = null;
        }
    }

    cloudUp(id, info) {
        let cloud = {key: id, val: info, redis: null};
        clouds.set(id, cloud);
        if (this.currentCloud === undefined) {
            this.currentCloud = cloud;
            this.cuhandler(id, info);
        }
    }

    cloudDown(id) {
        if (this.currentCloud !== undefined && this.currentCloud.key === id) {
            this.cdhandler(id);
            clouds.delete(id);
            this.currentCloud = undefined;
        } else 
            clouds.delete(id);

        if (this.currentCloud === undefined) {
            if (clouds.size > 0)
                this.currentCloud = __getACloud(clouds);
        }
    }

    cloudDataUp(id, info) {
        let cloud = clouds.get(id);
        if (cloud !== undefined) {
            cloud.redis = info;
            if (this.currentCloud === cloud) 
                this.cduhandler(id, info);
        }
    }

    cloudDataDown(id) {
        let cloud = clouds.get(id);
        if (cloud !== undefined) {
            cloud.redis = info;
            if (this.currentCloud === cloud) 
                this.cddhandler(id);
        }
    }
}

module.exports = NodeCache;


/*
 * Utility functions used by the NodeCache:
 */

function distanceToFog(info) {
    if (info.loc !== undefined) 
        return helper.geo2Distance(jsys.long, jsys.lat, info.loc.long, info.loc.lat);
    else 
        return helper.geo2Distance(jsys.long, jsys.lat, info.long, info.lat);
}

function __getACloud(cl) {
    let key = cl.keys().next().value;
    return cl.get(key);
}
