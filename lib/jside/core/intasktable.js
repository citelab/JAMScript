'use strict';

const { CmdNames,
        TTConfig, 
        INQ_States } = require("../utils/constants");

let tasktbl;
let oldsize;


class InTaskTable {

    constructor() {
        tasktbl = new Map();
        oldsize = 0;
        setInterval(()=> {
            tasktbl.forEach((rec, k)=> {
                rec.count--;
                if (rec.count < 0 && rec.callback !== null) 
                    rec.callback(INQ_States.ERROR, {cmd: CmdNames.ERROR, subcmd: CmdNames.ERROR});
            });
        }, TTConfig.CLOCK_INTERVAL);
    }

    findExact(id) {
        return tasktbl.get(id);
    }

    getsize() {
        return tasktbl.size;
    }

    // TODO: complete this one
    findApprox(name, params) {
        return undefined;
    }

    delete(id) {
        tasktbl.delete(id);
    }

    resetCB(id) {
        let ientry = tasktbl.get(id);
        if (ientry !== undefined) 
            ientry.callback = null;
    }

    updateCB(id, cb) {
        let ientry = tasktbl.get(id);
        if (ientry !== undefined) {
            ientry.callback = cb;
        }
    }

    putResults(id, state, result, cb) {
        let ientry = {count: TTConfig.CLOCK_COUNT, state: state, results: result, callback: cb};
        tasktbl.set(id, ientry);
    }

    // TODO: complete this one
    updatePCache(name, params, flag, result) {

    }
}

module.exports = InTaskTable;