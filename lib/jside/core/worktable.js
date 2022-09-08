'use strict';

let worktbl;

class WorkTable {
    constructor() {
        worktbl = new Map();
    }

    get(id) {
        return worktbl.get(id);
    }

    delete(id) {
        worktbl.delete(id);
    }

    insert(id, rec, callback) {
        worktbl.set(id, {record: rec, callback: callback});
    }
}

module.exports = WorkTable;