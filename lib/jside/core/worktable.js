'use strict';

const {EventEmitter} = require('events');

const   SMALL_TIMEOUT_VALUE = 500,
        LARGE_TIMEOUT_VALUE = 2000;

const WorkState = { REQ_SENT: 1,
                    ACK_RECD: 2,
                    NAK_RECD: 3,
                    RES_RECD: 4,
                    WAITING: 5,
                    WAITING_2: 6};

let worktbl;

class WorkTable {
    constructor() {
        worktbl = new Map();
    }

    get(id) {
        return worktbl.get(id);
    }

    delete(id) {
        let entry = worktbl.get(id);
        clearTimeout(entry.shorthandle);
        clearTimeout(entry.longhandle);
        worktbl.delete(id);
    }

    processAck(id, nodeid) {
        let entry = worktbl.get(id);
        if (entry !== undefined) {
            if (entry.state === WorkState.REQ_SENT || entry.state === WorkState.NAK_RECD)
                entry.state = WorkState.ACK_RECD;
            if (entry.ackcnt === 0) 
                entry.acktime = new Date().getTime() - entry.createtime;
            if (entry.acknodes.includes(nodeid) === false) {
                entry.acknodes.push(nodeid);
                entry.ackcnt++;
                if (entry.shorthandle !== undefined)
                    entry.shorthandle.refresh();
                if (entry.longhandle !== undefined)
                    entry.longhandle.refresh();
            }
        }
    }

    processNak(id) {
        let entry = worktbl.get(id);
        if (entry !== undefined && entry.state === WorkState.REQ_SENT) 
            entry.state = WorkState.NAK_RECD;
    }

    processRes(id, nodeid) {
        let entry = worktbl.get(id);
        if (entry !== undefined) {
            if (entry.state === WorkState.REQ_SENT || entry.state === WorkState.NAK_RECD)
                return;
            if (entry.state === WorkState.ACK_RECD)
                entry.state = WorkState.RES_RECD;
            if (entry.rescnt === 0) {
                entry.restime = new Date().getTime() - entry.createtime;
                clearTimeout(entry.shorthandle);
            }
            if (entry.resnodes.includes(nodeid) === false) {
                entry.resnodes.push(nodeid);
                entry.rescnt++;
                if (entry.state !== WorkState.WAITING && entry.longhandle !== undefined)
                    entry.longhandle.refresh();
                return true;
            }
        }
        return false;
    }

    gotoSubWaiting(id) {
        let entry = worktbl.get(id);
        if (entry !== undefined && entry.state === WorkState.RES_RECD)
            entry.state = WorkState.WAITING_2;
    }

    __pending(cmd) {
        let rarr = [];
        if (worktbl.size == 0)
            return 1;
        worktbl.forEach((v, k) => {
            if (v.record.cmd === cmd && v.rescnt > 0)
                rarr.push(v.rescnt);
        });
        if (rarr.length === 0)
            return 1;
        else {
            rarr.sort(function(a, b) { return (a - b);});
            return rarr[Math.floor(rarr.length/2)];
        }
    }

    __computeValue(arr) {
        let sum = 0;
        arr.forEach((v)=>{ sum += v;});
        let avg = sum/arr.length;
        let stsum = 0;
        arr.forEach((v)=>{ stsum += (v - avg) * (v - avg);});
        let stavg = Math.sqrt(stsum/arr.length);

        return Math.round(avg + 2 * stavg);
    }

    __setTimeouts(entry) {
        let stout, ltout;
        stout = SMALL_TIMEOUT_VALUE;
        ltout = LARGE_TIMEOUT_VALUE;

        entry.shorthandle = setTimeout(()=> {
            if (entry.state === WorkState.WAITING_2) 
                entry.channel.emit("gotTimeout2", entry.record.taskid);
            else
                 entry.channel.emit("gotTimeout", entry.record.taskid);
            entry.shorthandle = undefined;
        }, stout);
        entry.longhandle = setTimeout(()=> {
            if (entry.state === WorkState.WAITING_2) 
                entry.channel.emit("gotTimeout2", entry.record.taskid);
            else 
                entry.channel.emit("gotTimeout", entry.record.taskid);
            entry.longhandle = undefined;
        }, ltout);
    }

    createEntry(id, rec) {
        let wentry = {  record: rec,
                        state: WorkState.REQ_SENT,
                        channel: new EventEmitter(),
                        ackcnt: 0,
                        rescnt: 0,
                        acknodes: [],
                        resnodes: [],
                        createtime: new Date().getTime(),
                        acktime: undefined,
                        restime: undefined,
                        pending: this.__pending(rec.cmd),
                        shorthandle: undefined,
                        longhandle: undefined
                     };
        this.__setTimeouts(wentry);
        worktbl.set(id, wentry);
        return wentry;
    }

    refreshTimeout(id) {
        let wentry = worktbl.get(id);
        if (wentry !== undefined) {
            if (wentry.shorthandle !== undefined)
                wentry.shorthandle.refresh();
            if (wentry.longhandle !== undefined) 
                wentry.longhandle.refresh();
        }
    }
}

module.exports = WorkTable;