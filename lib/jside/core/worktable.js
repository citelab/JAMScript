'use strict';

const {EventEmitter} = require('events');
const CmdNames = require('../utils/constants').CmdNames;

let worktbl;
let moentry;
let roentry;

class WorkTable {
    constructor() {
        worktbl = new Map();
    }

    get(id) {
        return worktbl.get(id);
    }

    delete(id) {
        let wentry = worktbl.get(id);
        if (wentry !== undefined && wentry.record.results === true) 
            if (wentry.record.cmd === CmdNames.REXEC)
                roentry = wentry;
            else if (wentry.record.cmd === CmdNames.MEXEC)
                moentry = wentry;
        worktbl.delete(id);
    }

    incrementRexecAckCnt(id) {
        let entry = worktbl.get(id);
        if (entry !== undefined) {
            entry.ackcnt++;
            return;
        }
        if (roentry !== undefined && roentry.record.taskid === id) 
            roentry.ackcnt++;
    }

    incrementRexecResCnt(id) {
        let entry = worktbl.get(id);
        if (entry !== undefined) {
            entry.rescnt++;
            return;
        }
        if (roentry !== undefined && roentry.record.taskid === id) 
            roentry.rescnt++;
    }

    incrementMexecAckCnt(id) {
        let entry = worktbl.get(id);
        if (entry !== undefined) {
            entry.ackcnt++;
            return;
        }
        if (moentry !== undefined && moentry.record.taskid === id) 
            moentry.ackcnt++;
    }

    incrementMexecResCnt(id) {
        let entry = worktbl.get(id);
        if (entry !== undefined) {
            entry.rescnt++;
            return;
        }
        if (moentry !== undefined && moentry.record.taskid === id) 
            moentry.rescnt++;
    }

    pending(cmd) {
        if (cmd === CmdNames.REXEC) {
            if (roentry === undefined)
                return 1;
            else 
                return roentry.rescnt;
        } else if (cmd === CmdNames.MEXEC) {
            if (moentry === undefined)
            return 1;
        else 
            return moentry.rescnt;
        }
    }

    createEntry(id, rec) {
        let wentry = {  record: rec,
                        channel: new EventEmitter(),
                        ackcnt: 0,
                        rescnt: 0,
                        pending: this.pending(rec.cmd),
                        thandle: undefined
                     };
        worktbl.set(id, wentry);
        return wentry;
    }

    rewriteTimeout(id) {
        let wentry = worktbl.get(id);
        if (wentry !== undefined) {
            if (wentry.thandle !== undefined)
                clearTimeout(wentry.thandle);
            wentry.thandle = setTimeout(()=> {
                wentry.channel.emit("gotTimeout");
            }, 2000);
        }
    }

}

module.exports = WorkTable;