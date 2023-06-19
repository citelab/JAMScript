'use strict';


let tasktbl;


class InTaskTable {

    constructor() {
        tasktbl = new Map();
    }

    findExact(id) {
        return tasktbl.get(id);
    }

    // TODO: complete this one
    findApprox(name, params) {
        return undefined;
    }

    updateCB(id, cb) {
        let ientry = tasktbl.get(id);
        if (ientry !== undefined) {
            ientry.callback = cb;
        }
    }

    putResults(id, state, result, cb) {
        let ientry = {state: state, results: result, callback: cb};
        tasktbl.set(id, ientry);
    }

    // TODO: complete this one
    updatePCache(name, params, flag, result) {

    }
}

module.exports = InTaskTable;