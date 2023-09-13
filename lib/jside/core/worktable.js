'use strict';

const {EventEmitter} = require('events');

const   SMALL_TIMEOUT_VALUE = 10000,
        LARGE_TIMEOUT_VALUE = 10000;

const WorkState = { REQ_SENT: 1,
                    ACK_RECD: 2,
                    NAK_RECD: 3,
                    RES_RECD: 4,
                    WAITING: 5};

let worktbl;

/*
    WHAT IS HAPPENING IN THE WORKTABLE?

    Each entry has a short timeout and long timeout. Short timeout is used to detect whether we are getting 
    Acks. If we don't get any Acks after short timeout, we raise the JRUNTIME_TIMEOUT_ERROR. This tells the app
    that there is a disconnection error. For the above to work, we clear the short timeout when the first Ack 
    comes in.

    If we receive only Naks within the short timeout, we report the JRUNTIME_CONDITION_ERROR. If we receive Naks and
    Acks, there is no error to report. 

    We count the number of Acks. The pendingResults will be true if the ackCnt - resCnt > 0. Otherwise, the pendingResults
    is false. We stop the asyncIterator when the pendingResults is false or the long timeout is triggered. 

    Everytime a results comes in, the long timeout is extended by SMALL_TIMEOUT_VALUE. 
    When the long timeout is triggered, we just return. No value is there to be returned.

    The workTable is used as a information lookup. Note that the "result" propagation does not go through this one.

*/


class WorkTable {
    constructor() {
        worktbl = new Map();
    }

    get(id) {
        return worktbl.get(id);
    }

    getvalues(id) {
        let entry = worktbl.get(id);
        if (entry !== undefined) {
            return entry.values;
        } else 
            return [];
    }

    delete(id) {
        let entry = worktbl.get(id);
        clearTimeout(entry.shorthandle);
        clearTimeout(entry.longhandle);
        worktbl.delete(id);
    }

    pendingResults(id) {
        let entry = worktbl.get(id);
        if (entry !== undefined) {
            if (entry.ackcnt === 0 || entry.ackcnt > entry.rescnt)
                return true;
            else 
                return false;
        } else 
            return false;
    }

    processAck(id, nodeid) {
        let entry = worktbl.get(id);
        if (entry !== undefined) {
            if (entry.state === WorkState.REQ_SENT || entry.state === WorkState.NAK_RECD)
                entry.state = WorkState.ACK_RECD;
            if (entry.acknodes.includes(nodeid) === false) {
                entry.acknodes.push(nodeid);
                entry.ackcnt++;
                if (entry.shorthandle !== undefined) {
                    clearTimeout(entry.shorthandle);
                    entry.shorthandle = undefined;
                }
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

    processRes(id, nodeid, val) {
        let entry = worktbl.get(id);
        if (entry !== undefined) {
            if (entry.state === WorkState.REQ_SENT || entry.state === WorkState.NAK_RECD)
                return false;
            if (entry.state === WorkState.ACK_RECD)
                entry.state = WorkState.RES_RECD;

            if (entry.resnodes.includes(nodeid) === false) {
                entry.resnodes.push(nodeid);
                entry.values.push(val);
                entry.rescnt++;
                clearTimeout(entry.longhandle);
                this.__setTimeoutLong(entry, SMALL_TIMEOUT_VALUE);
                return true;
            }
        }
        return false;
    }

    __setTimeoutShort(entry, delay=SMALL_TIMEOUT_VALUE) {
        entry.shorthandle = setTimeout(()=> {
            entry.channel.emit("gotTimeout", entry.record.taskid);
            entry.shorthandle = undefined;
        }, delay);
    }

    __setTimeoutLong(entry, delay=LARGE_TIMEOUT_VALUE) {
        entry.longhandle = setTimeout(()=> {
            entry.channel.emit("gotClosing", entry.record.taskid);
            entry.longhandle = undefined;
        }, delay);
    }

    createEntry(id, rec) {
        let wentry = {  record: rec,
                        state: WorkState.REQ_SENT,
                        channel: new EventEmitter(),
                        ackcnt: 0,
                        rescnt: 0,
                        acknodes: [],
                        resnodes: [],
                        values: [],
                        shorthandle: undefined,
                        longhandle: undefined
                     };
        this.__setTimeoutShort(wentry);
        this.__setTimeoutLong(wentry);
        worktbl.set(id, wentry);
        return wentry;
    }
}

module.exports = WorkTable;