'use strict';

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
                    rec.count = TTConfig.CLOCK_COUNT;
                    if (--rec.retry <= 0) {
                        // TODO: This needs revision.. logic is messy..
                        if (rec.state !== StateNames.RES_RECVD)
                            rec.callback(StateNames.TIMEOUT, rec.state > StateNames.BOOSTED);
                        else 
                            tasktbl.delete(rec.id);
                        if (rec.retry < -2)
                            tasktbl.delete(rec.id);
                    } else
                        if (rec.retrycallback !== undefined)
                            rec.retrycallback(rec.state);
                }
            });
        }, TTConfig.CLOCK_INTERVAL);
    }

    get(id) {
        return tasktbl.get(id);
    }

    insert(id, callback, retrycb) {
        count++;
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
        let rec = tasktbl.get(id);
        if (rec !== undefined) {
            rec.count -= TTConfig.ACK_BOOST;
            if (rec.count < 0)
                rec.callback(StateNames.CLOSING, rec.state === StateNames.BOOSTED);
        }
    }

    delete(id) {
        tasktbl.delete(id);
    }

    processAck(id) {
        let tent = tasktbl.get(id);
        if (tent !== undefined) {
            tent.state = StateNames.ACK_RECVD;
            tent.callback(StateNames.ACK_RECVD, tent.state === StateNames.BOOSTED);
        }
    }

    processRes(id, val) {
        let tent = tasktbl.get(id);
        if (tent !== undefined) {
            tent.state = StateNames.RES_RECVD;
            tent.callback(StateNames.RES_RECVD, val);
        }
    }
}

module.exports = OutTaskTable;