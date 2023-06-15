'use strict';

const { CmdNames } = require('../utils/constants');

let TTConfig = require('../utils/constants').TTConfig,
    StateNames = require('../utils/constants').StateNames;

let tasktbl;

// NOTE: state needs to move forward - so we cannot do unconditional state transfer/assignment

class OutTaskTable {

    // The constructor has the timeout loop. This way we don't have a timeout event for each
    // entry, which is too expensive. We have each entry with its own associated count. We 
    // decrement the count and then fire the corresponding timeout event. There is no timeout 
    // event, if no reply 
    constructor() {
        tasktbl = new Map();
        setInterval(()=> {
            tasktbl.forEach((rec, k)=> {
                rec.count--;
                if (rec.rrequired) {
                    if (rec.state !== StateNames.CLOSING && rec.count <= 0) {
                        // reset the count again
                        rec.count = TTConfig.CLOCK_COUNT;
                        if (--rec.retry <= 0) {
                            // we are exhausted with the retries.. now we need to decide
                            // if the result has not arrived, we timeout 
                            // the entry remains.. until it is deleted due to PURGE from the application thread
                            if (rec.retry < -2 || rec.state !== StateNames.RES_RECVD)
                                rec.callback(StateNames.TIMEOUT, rec.state > StateNames.BOOSTED);
                        } else {
                            console.log("================= Retry called................", rec.id);
                            // do the retry everytime the count goes down to zero
                            // number of retries is limited to the number we have in retry counter
                            if (rec.retrycallback !== undefined)
                                rec.retrycallback(rec.state);
                        }
                    }
                } else {
                    if (rec.state !== StateNames.ACK_RECVD) {
                        if (--rec.retry > 0 && rec.retrycallback !== undefined)
                            rec.retrycallback(rec.state);
                        rec.callback(StateNames.TIMEOUT, false);
                    }
                }
            });
        }, TTConfig.CLOCK_INTERVAL);
    }

    get(id) {
        return tasktbl.get(id);
    }

    insert(id, rrequired, callback, retrycb) {
        console.log("INserted.....", id, tasktbl.size);
        tasktbl.set(id, {id: id, rrequired: rrequired, state: StateNames.INITIAL, count: TTConfig.CLOCK_COUNT, retry: TTConfig.MAX_RETRIES, callback: callback, retrycallback: retrycb});
    }

    // this is only called when the return result is needed.. we are not checking for that condition
    extendlife(id) {
        let rec = tasktbl.get(id);
        if (rec !== undefined) {
            rec.state = rec.state < StateNames.BOOSTED ? StateNames.BOOSTED : rec.state
            if (rec.count < TTConfig.ACK_BOOST * TTConfig.BOOST_LIMIT)
                rec.count += TTConfig.ACK_BOOST;
        }
    }

    close(id) {
        console.log("Closing....", id);
        let rec = tasktbl.get(id);
        if (rec !== undefined) {
            rec.state = StateNames.CLOSING;
            rec.count -= TTConfig.ACK_BOOST;
        }
    }

    purge(id) {
        let rec = tasktbl.get(id);
        if (rec !== undefined && rec.rrequired && rec.state === StateNames.CLOSING) {
            tasktbl.delete(id);
            return;
        }

        if (rec !== undefined && rec.rrequired === false)
            tasktbl.delete(id);
    }

    processAck(id, timeout) {
        let tent = tasktbl.get(id);
        if (tent !== undefined) {
            // We do a check to set the state - this way the state is changing in a monotonic direction
            if (tent.state === StateNames.INITIAL || tent.state === StateNames.ERR_RECVD)
                tent.state = StateNames.ACK_RECVD;
            // However, we are letting the worker side know about an out-of-order ACK
            tent.callback(StateNames.ACK_RECVD, timeout);
        }
    }

    processRes(id, val) {
        let tent = tasktbl.get(id);
        if (tent !== undefined) {
            if (tent.state === StateNames.ACK_RECVD)
                tent.state = StateNames.RES_RECVD;
            console.log("Calling.....", tent.callback, " .. with .. ", StateNames.RES_RECVD, val)
            tent.callback(StateNames.RES_RECVD, val);
        }
    }

    processNak(id, errcode) {
        let tent = tasktbl.get(id);
        if (tent !== undefined && errcode === CmdNames.COND_FALSE) {
            if (tent.state === StateNames.INITIAL || tent.state === StateNames.ACK_RECVD)
                tent.state = StateNames.ERR_RECVD;
            tent.callback(StateNames.ERR_RECVD, errcode);
        }
    }

    processErr(id, errcode) {
        let tent = tasktbl.get(id);
        if (tent !== undefined) {
            if (tent.state === StateNames.INITIAL || tent.state === StateNames.ACK_RECVD)
                tent.state = StateNames.ERR_RECVD;
            tent.callback(StateNames.ERR_RECVD, errcode);
        }
    }
}

module.exports = OutTaskTable;