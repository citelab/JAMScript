'use strict';

// =============================================================================
// RunTable maintenance routines.
// RunTable is keeping track of the tasks that are running at any given time.
// =============================================================================

var gauss = require('gaussian'),
    Random = require('random-js'),
    cbor = require('cbor');

var globals = require('./constants').globals;

var mserv,
    random,
    gfunc,
    runTable;

class RunTable {

    constructor(server) {
        mserv = server;
        random = new Random(Random.engines.mt19937().autoSeed());;

        // Use a gaussian function with mean 8 and std 1.0 - why this value??
        gfunc = gauss(5.0, 1.0);
        runTable = new Map();
    }

    get(runid) {
        return runTable.get(runid);
    }

    // The callback runs when an ACK message comes back
    // It typically removes the entry and does housekeeping
    insert(runid, tmsg, topic, callback) {

        // Send the message out...
        if (mserv !== undefined)
            mserv.publish(topic, cbor.encode(tmsg));

        var rentry = {msg:tmsg, type: tmsg.opt, started:false, topic:topic, cback:callback, tick:1, thandle:null, exception:true};
        // Set the Interval based timeout
        var tihandle = setInterval(processTimeout, globals.Timeouts.RUN_TABLE, rentry);

        // Insert the timeout handler into the entry
        rentry.thandle = tihandle;
        runTable.set(runid, rentry);
    }

    delete(runid) {

        var rentry = runTable.get(runid);
        if (rentry !== undefined) {
            if (rentry.thandle !== undefined) {
                clearInterval(rentry.thandle);
            }
            runTable.delete(runid);
        }
    }

    offException(runid) {

        var rentry = runTable.get(runid);
        if (rentry !== undefined) {
            rentry.exception = false;
            runTable.set(runid, rentry);        // This is not necessary... rentry should be already changed
        }
    }

}

// At timeout run this function
function processTimeout(rentry) {

    // No need to process further if the sync task has already started..
    if (rentry.type == 'SYN' && rentry.started)
        return;

    var coff = gfunc.cdf(rentry.tick);

    var rval = random.real(0, 1.0);
    if (rval > coff) {
        mserv.publish(rentry.topic, cbor.encode(rentry.msg));       // Republish the message
    }
    rentry.tick++;
}

function updateRTTicks() {

    for (var [key, val] of runTable) {
        if (val.tick > 0)
            val.tick = val.tick - 1;
        runTable.set(key, val);
    }
}


module.exports = RunTable;
