'use strict';

/* 
 * This module implements the node cache.
 * When a fog or cloud becomes available we put it here. Same way
 * when a fog or cloud goes down. The nodeCache is responsible for
 * selecting the nodes to replace the down ones or the initial ones
 * to connect.
 */
const   helper = require('../utils/helper'),
        constants = require('../utils/constants');

let     activefogs,
        otherfogs,
        clouds;

class NodeCache {
    constructor(idelay, dstep, fdelay, linkp) {
        activefogs = new Map();
        otherfogs = new Map();
        clouds = new Map();

        this.currentCloud;

        this.idelay = idelay;
        this.dstep = dstep;
        this.fdelay = fdelay;
        this.selPolicy = linkp;
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
        var fog = activefogs.get(id);
        let fogactivated = false;
        if (fog !== undefined)
            return;
        if (activefogs.size < constants.FogPolicy.numFogs) {
            activefogs.set(id, {key: id, val: info, redis: null});
            this.fuhandler(id, info);
            return;
        } else if (selPolicy === constants.FogPolicy.bestFogSelector) {
            let dist = distanceToFog(fog);
            activefogs.forEach((rec, k)=> {
                if ((fogactivated === false) && (distanceToFog(rec) > dist)) {
                    this.fdhandler(rec.key, rec.val);
                    this.fuhandler(id, info);
                    activefogs.set(id, {key: id, val: info, redis: null});
                    fogactivated = true;
                }
            });
        }
        if (fogactivated === false)
            otherfogs.set(id, {key: id, val: info, redis: null});
    }

    fogDown(id) {
        let fog = activefogs.get(id);
        if (fog !== undefined) {
            this.fdhandler(fog.key, fog.val);
            activefogs.delete(id);
        } else 
            otherfogs.delete(id)
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
}

module.exports = NodeCache;

function __getACloud(cl) {
    let key = cl.keys().next().value;
    return cl.get(key);
}


/*
 * Utility functions used by the NodeCache:
 */

/* 
 * RandomFogSelector: pick a fog among the available fogs. Return undefined 
 * if there are no fogs. Ineligible fogs are not considered in the selection.
 */
function randomFogSelector() {
    if (fogs.size === 0)
        return undefined;
    /*
     * Randomly pick a fog from the map and return
     */
    let fitems = [];
    /* 
     * Remove ineligible fogs - that is early insertions.
     */
    for (let fog of fogs.values()) {
        if (fog.val !== null)
            fitems.push(fog);
    }
    return fitems[Math.floor(Math.random() * fitems.length)];
}

function nearFogSelector() {
    if (fogs.size === 0)
        return undefined;

    var mobj;
    var sum = 1000000000.0;             // upper bound for the sum distance

    for (let fog of fogs.values()) {
        if (fog.val !== null) {
            var loc = fog.val.loc;
            msum = helper.geo2Distance(sys.long, sys.lat, loc.long, loc.lat);
            if (msum < sum) {
                sum = msum;
                mobj = fog;
            }
        }
    }
    return mobj;
}

function fogSelector() {
    switch (selPolicy) {
        case 'random':
            return randomFogSelector();
        case 'near':
            return nearFogSelector();
        case 'best':
            return bestFogSelector();
    }
}

/*
 * Return the first one.. we should not have too many clouds!
 * Selection is trivial
 */
function cloudSelector() {
    if (clouds.size === 0)
        return undefined;
    return clouds.entries().next().value[1];
}
