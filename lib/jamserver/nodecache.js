//===================================================================
// This module implements the node cache.
// When a fog or cloud becomes available we put it here. Same way
// when a fog or cloud goes down. The nodeCache is responsible for
// selecting the nodes to replace the down ones or the initial ones
// to connect.
//===================================================================


const globals = require('./constants').globals,
    sys = require('./jamsys');


var fogs = new Map(),
    clouds = new Map();

var fuhandler,
    fduhandler,
    fddhandler,
    cuhandler,
    cduhandler,
    cddhandler,
    fdhandler,
    cdhandler;

var count = 1;

var selPolicy = 'random';      // default is rand

var currentFog,
    currentCloud;


function randomFogSelector() {

    if (fogs.size === 0)
        return undefined;

    // Randomly pick a fog from the map and return
    var items = Array.from(fogs);
    var fitems = []
    // Remove ineligible fogs - that is early insertions..
    items.forEach(function(obj, idx) {
        if (obj[1].val !== null)
            fitems.push(obj);
    });

    return fitems[Math.floor(Math.random() * fitems.length)];
}


function measure(lon1, lat1, lon2, lat2) {

    // generally used geo measurement function
    var R = 6378.137; // Radius of earth in KM
    var dLat = lat2 * Math.PI / 180 - lat1 * Math.PI / 180;
    var dLon = lon2 * Math.PI / 180 - lon1 * Math.PI / 180;
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    var d = R * c;
    return d * 1000; // meters
}


function nearFogSelector() {

    if (fogs.size === 0)
        return undefined;

    var items = Array.from(fogs);
    var mobj;
    var sum = 1000000000.0; // upper bound for the sum distance

    items.forEach(function (obj, idx) {
        var loc = obj[1].val.loc;
        msum = measure(sys.long, sys.lat, loc.long, loc.lat);
        if (msum < sum) {
            sum = msum;
            mobj = obj;
        }
    });

    return mobj;
}


function fogSelector() {

    switch (selPolicy) {
        // Other policies should go above this line..
        case 'random':
            return randomFogSelector();
        case 'near':
            return nearFogSelector();
        case 'best':
            return bestFogSelector();
    }
}


function cloudSelector() {

    if (clouds.size === 0)
        return undefined;

    var items = Array.from(clouds);
    // Return the first one.. we should not have too many clouds!
    // Selection is trivial
    return items[0];
}


module.exports = function(idelay, dstep, fdelay, linkp) {

    selPolicy = linkp;

    // Hookup the handlers...
    this.onFogUp = function(handler) {
        fuhandler = handler;
    }

    this.onFogDown = function(handler) {
        fdhandler = handler;
    }

    this.onFogDataUp = function(handler) {
        fduhandler = handler;
    }

    this.onFogDataDown = function(handler) {
        fddhandler = handler;
    }

    this.onCloudUp = function(handler) {
        cuhandler = handler;
    }

    this.onCloudDown = function(handler) {
        cdhandler = handler;
    }

    this.onCloudDataUp = function(handler) {
        cduhandler = handler;
    }

    this.onCloudDataDown = function(handler) {
        cddhandler = handler;
    }

    this.fogUp = function(id, info) {

        var fog = fogs.get(id);
        if (fog !== undefined) {
            fog.key = id;
            fog.val = info;
        } else
            fog = {key: id, val: info, redis: null};
        fogs.set(id, fog);
    }

    this.fogDataUp = function(id, info) {

        var fog = fogs.get(id);

        if (id === currentFog) {

            if (fog !== undefined)
                fog.redis = info;
            fduhandler(info);
        }
        else
        {
            if (fog !== undefined) {
                fog.redis = info;
            } else {
                fog = {key: id, val: null, redis: info};
                fogs.set(id, fog);
            }
        }
    }

    this.cloudUp = function(id, info) {

        var cloud = clouds.get(id);
        if (cloud !== undefined) {
            cloud.key = id;
            cloud.val = info;
        } else
            cloud = {key: id, val: info, redis: null};
        clouds.set(id, cloud);
    }

    this.cloudDataUp = function(id, info) {

        var cloud = clouds.get(id);

        if (id === currentCloud) {

            if (cloud !== undefined)
                cloud.redis = info;
            cduhandler(info);
        }
        else
        {
            if (cloud !== undefined)
                cloud.redis = info;
            else {
                cloud = {key: id, val: null, redis: info};
                clouds.set(id, cloud);
            }
        }
    }

    this.fogDown = function(id) {

        if (id === currentFog) {
            var fval = fogs.get(id);
            if (fval !== undefined) {
                // Down the current one..
                fdhandler(fval.key, fval.val);
                currentFog = undefined;
                fogs.delete(id);

                // Select another
                var nfog = fogSelector();
                if (nfog !== undefined) {
                    currentFog = nfog[1].key;
                    fuhandler(nfog[1].key, nfog[1].val);
                    if (nfog[1].redis !== null)
                        fduhandler(nfog[1].redis);
                }
            }
        } else
            fogs.delete(id);
    }

    this.cloudDown = function(id) {

        if (id === currentCloud) {
            var cval = clouds.get(id);
            if (cval !== undefined) {
                // Down the current one..
                cdhandler(cval.key, cval.val);
                currentCloud = undefined;
                clouds.delete(id);

                // Select another
                var ncld = cloudSelector();
                if (ncld !== undefined) {
                    currentCloud = ncld[1].key;
                    cuhandler(ncld[1].key, ncld[1].val);
                    if (ncld[1].redis !== null)
                        cduhandler(ncld[1].redis);
                }
            }
        } else
            clouds.delete(id);
    }

    this.setCurrentFog = function(fog) {
        currentFog = fog;
    }

    this.setCurrentCloud = function(cloud) {
        currentCloud = cloud;
    }

    var selectTimer = setTimeout(function runSelection() {

        // Run the node selector...
        if (currentCloud === undefined) {
            var ncld = cloudSelector();

            if (ncld !== undefined) {
                currentCloud = ncld[1].key;
                cuhandler(ncld[1].key, ncld[1].val);
                if (ncld[1].redis !== null)
                    cduhandler(ncld[1].redis);
            }
        }

        if (currentFog === undefined) {
            var nfog = fogSelector();
            if (nfog !== undefined) {
                currentFog = nfog[1].key;
                fuhandler(nfog[1].key, nfog[1].val);
                console.log("--------------------Selecting another fog...... Redis", nfog[1]);
                if (nfog[1].redis !== null)
                    fduhandler(nfog[1].redis);
            }
        } else if (selPolicy === 'near') {
            // find the closest fog among the available ones
            var nfog = nearFogSelector();
            if (currentFog !== nfog[1].key) {
                // closer than the one connected
                // then, disconnect from the old one, connect to the new one
                var cfog = fogs.get(currentFog);
                fdhandler(cfog.key, cfog.val);
                if (fddhandler !== undefined)
                    fddhandler();

                // bring up the new one
                console.log("--------------------Selecting another fog...... Redis", nfog[1]);
                fuhandler(nfog[1].key, nfog[1].val);

                if (nfog[1].redis !== null)
                    fduhandler(nfog[1].redis);
            }
        } else if (selPolicy === 'best') {
            //
        }

        // Do the selection again at a later time...
        if (idelay + dstep * count < fdelay)
            setTimeout(runSelection, idelay + dstep * count);
        else
            setTimeout(runSelection, fdelay);
    }, idelay);
}
