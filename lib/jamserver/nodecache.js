//===================================================================
// This module implements the node cache.
// When a fog or cloud becomes available we put it here. Same way
// when a fog or cloud goes down. The nodeCache is responsible for
// selecting the nodes to replace the down ones or the initial ones
// to connect.
//===================================================================


var globals = require('./constants').globals;

var fogs = new Map(),
    clouds = new Map();

var fuhandler = undefined,
    cuhandler = undefined,
    fdhandler = undefined,
    cdhandler = undefined;

var count = 1;

var selPolicy = 'random';      // default is rand

var currentFog = undefined,
    currentCloud = undefined;


function randomFogSelector() {

    if (fogs.size === 0)
        return undefined;

    // Randomly pick a fog from the map and return
    var items = Array.from(fogs);
    return items[Math.floor(Math.random() * items.length)];
}

function fogSelector() {

    switch (selPolicy) {
        // Other policies should go above this line..
        case 'random':
            return randomFogSelector();
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


module.exports = function(idelay, dstep, fdelay) {

    this.fogUp = function(id, info) {
        fogs.set(id, {key: id, val: info});
    }

    this.cloudUp = function(id, info) {
        clouds.set(id, {key: id, val: info});
    }

    this.onFogUp = function(handler) {
        fuhandler = handler;
    }

    this.onFogDown = function(handler) {
        fdhandler = handler;
    }

    this.onCloudUp = function(handler) {
        cuhandler = handler;
    }

    this.onCloudDown = function(handler) {
        cdhandler = handler;
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
            }
        }

        if (currentFog === undefined) {
            var nfog = fogSelector();
            if (nfog !== undefined) {
                currentFog = nfog[1].key;
                fuhandler(nfog[1].key, nfog[1].val);
            }
        }

        // Do the selection again at a later time...
        if (idelay + dstep * count < fdelay)
            setTimeout(runSelection, idelay + dstep * count);
        else
            setTimeout(runSelection, fdelay);
    }, idelay);
}
