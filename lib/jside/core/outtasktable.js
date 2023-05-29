'use strict';

const { CmdNames } = require('../utils/constants');

let TTConfig = require('../utils/constants').TTConfig,
    StateNames = require('../utils/constants').StateNames;

let tasktbl;

let count = 0;

class OutTaskTable {
    constructor() {
        tasktbl = new Map();
        setInterval(()=> {
            tasktbl.forEach((rec, k)=> {
                if (--rec.count <= 0) {
                    // reset the count again
                    rec.count = TTConfig.CLOCK_COUNT;
                    if (--rec.retry <= 0) {
                        // we are exhausted with the retries.. now we need to decide
                        // if the result has not arrived, we timeout 
                        // if the result has arrived, we just remove the entry 
                        // if the result hasn't arrived after after another retry.. we remove
                        if (rec.state !== StateNames.RES_RECVD)
                            rec.callback(StateNames.TIMEOUT, rec.state > StateNames.BOOSTED);
                        else 
                            tasktbl.delete(rec.id);
                        if (rec.retry < -2) {
                            rec.callback(StateNames.TIMEOUT, rec.state > StateNames.BOOSTED);
                            tasktbl.delete(rec.id);
                        }
                    } else {
                        console.log("================= Retry called................", rec.id);
                        // do the retry everytime the count goes down to zero
                        // number of retries is limited to the number we have in retry counter
                        if (rec.retrycallback !== undefined)
                            rec.retrycallback(rec.state);
                    }
                }
            });
        }, TTConfig.CLOCK_INTERVAL);
    }

    get(id) {
        return tasktbl.get(id);
    }

    insert(id, callback, retrycb) {
        count++;
        console.log("INserted.....", id, tasktbl.size);
        tasktbl.set(id, {id: id, state: StateNames.INITIAL, count: TTConfig.CLOCK_COUNT, retry: TTConfig.MAX_RETRIES, callback: callback, retrycallback: retrycb});
    }

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
            if (rec.count < 0)
                rec.callback(StateNames.CLOSING, rec.state === StateNames.BOOSTED);
        }
    }

    delete(id) {
        console.log("Deleting....", id);
        tasktbl.delete(id);
    }

    processAck(id, nodeid, timeout) {
        let tent = tasktbl.get(id);
        if (tent !== undefined) {
            tent.state = StateNames.ACK_RECVD;
            tent.callback(StateNames.ACK_RECVD, nodeid, tent.state === StateNames.BOOSTED);
        }
    }

    processRes(id, nodeid, val) {
        let tent = tasktbl.get(id);
        if (tent !== undefined) {
            tent.state = StateNames.RES_RECVD;
            tent.callback(StateNames.RES_RECVD, nodeid, val);
        }
    }

    processNak(id, nodeid, errcode) {
        let tent = tasktbl.get(id);
        if (tent !== undefined && errcode === CmdNames.COND_FALSE) {
            tent.state = StateNames.CLOSING;
            tent.callback(StateNames.CLOSING, nodeid, errcode);
        }
    }

    processErr(id, nodeid, errcode) {
        let tent = tasktbl.get(id);
        if (tent !== undefined) {
            tent.state = StateNames.ERR_RECVD;
            tent.callback(StateNames.ERR_RECVD, nodeid, errcode);
        }
    }
}

module.exports = OutTaskTable;