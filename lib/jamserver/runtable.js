'use strict';

// =============================================================================
// RunTable maintenance routines.
// RunTable is keeping track of the tasks that are running at any given time.
// =============================================================================

var cbor = require('cbor');
var globals = require('./constants').globals;

var runTable;
var jamcore;

class RunTable {

    constructor(jcore) {
        runTable = new Map();
        jamcore = jcore;
    }

    get(runid) {
        return runTable.get(runid);
    }

                                            
    // The callback runs when an ACK message comes back
    // It typically removes the entry and does housekeeping
    insert(runid, tmsg, cbid, targets, callback) {

        // form entry..
        var rentry = {msg:tmsg, type: tmsg.opt, targets: targets, results: {cloud:null, fog:null, device:null}, cbid: cbid, cback:callback, acks: {cloud:0, fog:0, device:0}, acktimer:undefined, waittimer: undefined, ackcount:0, waitcount:0, exception:true};

        // prepare the message 
        var cmsg = JSON.parse(JSON.stringify(tmsg));    // clone it
        delete(cmsg.cbid);
        var omsg = cbor.encode(cmsg);
        rentry.outmsg = omsg; 

        var flag = sendRequest(rentry);

        if (flag) {
            // Set a timeout
            var acktimer = setTimeout(processAckTimeout, globals.Timeouts.RUN_TABLE_ACK, runid);
            // Insert the timeout handler into the entry
            rentry.acktimer = acktimer;
            runTable.set(runid, rentry);
        } else 
            callback({code:"ERR", res:rentry.results});
    }


    processAck(rid, type) {

        var re = runTable.get(rid);
        if (re === undefined)
            return;

        // delete acktimer if it is running.
        if (re.acktimer !== undefined) {
            clearTimeout(re.acktimer);
            re.acktimer = undefined;
        }

        // increment ack count - used to determine how many results we will get
        re.acks[type] = re.acks[type] + 1;

        // we start the wait timer.. 
        setTimeout(processWaitTimeout, globals.Timeouts.WAIT_TIMEOUT, rid);
    }

    processResults(rid, type, res) {

        var re = runTable.get(rid);
        if (re === undefined)
            return;
          
        // put the results..
        if (type == 'cloud') {
            re.results[type] = res; 
        } else if ((type == 'fog') || (type == 'device')) {
            if (re.results[type] === null || re.results[type] === undefined) {
                re.results[type] = [];
                re.results[type].push(res[0]);
            } else {
                re.results[type].push(res[0]);
            }                
        }

        var pending = false;
        // check if all the results are there.. if so, trigger the callback 
        if ((re.acks.cloud > 0) && re.results.cloud == null) 
            pending = true; 
        
        if ((re.acks.fog > 0) && re.results.fog == null)
            pending = true; 
        else if ((re.acks.fog > 0) && re.results.fog.length < re.acks.fog)
            pending = true; 

        if ((re.acks.device > 0) && re.results.device == null)
            pending = true;
        else if ((re.acks.device > 0) && re.results.device.length < re.acks.device)
            pending = true; 

        if (pending === false) {
            re.cback({code:"RES", res:re.results});
        }
    }


    delete(runid) {

        var re = runTable.get(runid);
        if (re !== undefined) {
            if (re.acktimer !== undefined)            
                clearTimeout(re.acktimer);

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


function sendRequest(re) {

    var targets = re.targets;
    var omsg = re.outmsg;
    var flag = false;

    try {
        // scan targets and send out requests.
        targets.forEach(function (t) {

            if ((t.cloud !== undefined) && (t.cloud !== null)) {
                if (jamcore.cserv !== null) {
                    t.cloud.publish(t.topic, omsg);
                    flag = true;
                }
            }
            if ((t.fog !== undefined) && (t.fog !== null)) {
                if (jamcore.fserv !== null) {
                    t.fog.publish(t.topic, omsg);      
                    flag = true;
                }
            }
            if ((t.device !== undefined) && (t.device !== null)) {
                t.device.publish(t.topic, omsg);                                
                flag = true;
            }
        });
    } catch(e) {
        console.log(e);
    }

    return flag;
}


function processWaitTimeout(rid) {

    var re = runTable.get(rid);
    if (re !== undefined) {
        if (re.waitcount < globals.Counts.WAIT_COUNT) {
            sendRequest(re);
            re.waitcount++;
            setTimeout(processWaitTimeout, globals.Timeouts.WAIT_TIMEOUT, rid);
        } else 
            re.cback({code: 'ERR', res: re.results})
    }
}


// At timeout run this function
function processAckTimeout(rid) {

    var re = runTable.get(rid); 
    if (re !== undefined) {
        if (re.ackcount < globals.Counts.ACK_TIMEOUTS) {
            sendRequest(re);
            re.ackcount++;

            var acktimer = setTimeout(processAckTimeout, globals.Timeouts.RUN_TABLE_ACK, rid);
            re.acktimer = acktimer;
        } else 
            re.cback({code: "ERR", res:re.results});
    }
}


module.exports = RunTable;
