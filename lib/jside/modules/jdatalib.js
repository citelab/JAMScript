const Redis = require('ioredis');
const cbor = require('cbor-x');
const globals = require('../utils/constants').globals;
const jsys = require('../core/jamsys');
const CmdNames = require('../utils/constants').CmdNames;

/*
 * NOTE: See all the notes in the jredlib.lua file - this is the Redis Functions library 
 * One key assumption is that no through-the-store traffic. For example, devices do not push 
 * any traffic through the Redis stores at the fog to the cloud. Any such traffic is actually
 * relayed by the fog. 
 * 
 * The old version had automatic relaying at the data store level - one less feature!
 */

let fltable = new Map();
let myuid, myid;
let ufogs = new Map();
let uclouds = new Map();

module.exports = {
    updateUServers,
    createRedis,
    configureMainRedis,
    configureAuxRedis,
    getId,
    createDFlow,
    createUFlow
}

async function updateUServers(x) {
    let aux, listen;
    let lmyid;
    let xentry;

    console.log("updating servers....", x);
    switch (x.cmd) {
        case CmdNames.FOG_DATA_UP:
            aux = new Redis(x.info.host, x.info.port, {retryStrategy: null});
            lmyid = await getId(aux, myuid);
            listen = await configureAuxRedis(aux, lmyid, x.info.host, x.info.port);
            ufogs.set(x.id, {main: aux, listen: listen, myid: lmyid});
        break;
        case CmdNames.FOG_DATA_DOWN:
            xentry = ufogs.get(x.id);
            await closeAuxRedis(xentry);
            ufogs.delete(x.id);
        break;
        case CmdNames.CLOUD_DATA_UP:
            aux = new Redis(x.info.host, x.info.port, {retryStrategy: null});
            lmyid = await getId(aux, myuid);
            listen = await configureAuxRedis(aux, lmyid, x.info.host, x.info.port);
            uclouds.set(x.id, {main: aux, listen: listen, myid: lmyid});
        break;
        case CmdNames.CLOUD_DATA_DOWN:
            xentry = uclouds.get(x.id);
            await closeAuxRedis(xentry);
            uclouds.delete(x.id);
        break;
    }
}

function createRedis(host, port) {
    return new Redis(host, port, {retryStrategy: null});
}

async function configureMainRedis(main, host, port, uid, cb) {
    let listen = new Redis(host, port, {retryStrategy: null});
    main.on("ready", ()=> { cb(); });

    myuid = uid;
    myid = await getId(main, uid);
    await __configureUpListener(main, listen);
    let lib = await checkRedisLib(main);
    if (lib)
        return true;
    else {
        console.log("ERROR! Redis Library not found...");
        process.exit(1);
    }
}

async function configureAuxRedis(aux, lmyid, host, port) {
    let listen = new Redis(host, port, {retryStrategy: null});
    await __configureDownListener(aux, listen, lmyid);
    let lib = await checkRedisLib(aux);
    if (lib)
        return listen;
    else {
        console.log("ERROR! Redis Library not found...");
        process.exit(1);
    }
}

async function closeAuxRedis(x) {
    if (x.main !== undefined)
        x.main.quit();
    if (x.listen !== undefined)
        x.listen.quit();
}

async function createUFlow(rs, key) {
    return new UFlow(rs, key);
}

async function createDFlow(rs, key) {
    return new DFlow(rs, key);
}

async function __configureUpListener(r, l) {
    return new Promise((resolve, reject) => {
        l.subscribe("__keycompleted", (err, count) => {});
        l.on('message', (channel, key) => {
            if (channel === "__keycompleted") {
                let entry = fltable.get(key);
                if (entry !== undefined) {
                    switch (entry.type) {
                        case globals.RedisFuncs.UF_READ_FIRST:
                            r.call('fcall', 'uf_fread', 1, key, function(err, res) {
                                if (err === null)
                                    entry.callback(res);
                            });
                            break;
                        case globals.RedisFuncs.UF_READ_LAST:
                            r.call('fcall', 'uf_lread', 1, key, function(err, res) {
                                if (err === null)
                                    entry.callback(res);
                            });
                            break;
                    }
                }
            }
        });
        resolve(true);
    });
}

async function __configureDownListener(r, l, myid) {
    return new Promise((resolve, reject) => {
        l.subscribe("__keycompleted", (err, count) => {});
        l.on('message', (channel, key) => {
            if (channel === "__keycompleted") {
                let entry = fltable.get(key);
                if (entry !== undefined) {
                    switch (entry.type) {
                        case globals.RedisFuncs.DF_READ_TAIL:
                            r.call('fcall', 'df_tread', 1, key, function(err, res) {
                                if (err === null)
                                    entry.callback(res);
                            });
                            break; 
                        case globals.RedisFuncs.DF_READ_HEAD:
                            r.call('fcall', 'df_hread', 1, key, myid, function(err, res) {
                                if (err === null)
                                    entry.callback(res);
                            });
                            break; 
                    }
                }
            }
        });
        resolve(true);
    });
}


// return true if the Redis Functions are loaded.. check for given names
async function checkRedisLib(rserv) {
    return new Promise((resolve, reject) => {
        rserv.call('function', 'list', 'libraryname', 'jredlib', function(err, resp) {
            if (resp[0] !== undefined && resp[0][1] === 'jredlib')
                resolve(true);
            else 
                reject("jredlib Not Found");
        });
    });
}

// get the unique sequence identifier (this unique) with in the red server
async function getId(rserv, uid) {
    return rserv.call('fcall', 'get_id', 0, uid);
}


/*
* Design Thought on uFlow: 
* Multiple writers and a single reader. The uFlow is organized into rows that keep moving as they are written.
* A row will have all the elements that are produced at a particular jamclock. So, many nodes would be contributing 
* to a row. However, a row is not ready for consumption by the controller until all the workers that are supposed to 
* have contributed to it have written to the row. We maintain an expected number of contributors for each row. 
* When the number reaches that value, we release the row to the consumer by signalling the consumer to pick it up. 
* 
*/
class UFlow {
    constructor(rserv, key) {
        this.rs = rserv;
        this.key = key;
        this.id = myid;
    }

    async write(value) {
        let clock = jsys.getJAMClock();
        let rval = [];
        let iter;
        let x, y;

        return new Promise((resolve, reject) => {
            if (jsys.machtype === 'device') 
                iter = ufogs.values();
            else 
                iter = uclouds.values();

            while((x = iter.next()) && x.done === false) {
                let entry = x.value;
                let y = this.__write(entry.main, clock, value);
                rval.push(y);
            }
            if (y !== undefined) {
                Promise.all(y).then((yvals)=> {
                    resolve(yvals);
                });
            }
        });
    }

    __write(rserv, clock, value) {
        return new Promise((resolve, reject) => {
            let cval = cbor.encode(value);
            let val = cval.toString('base64');
            rserv.call('fcall', 'uf_write', 1, this.key, clock, 1, this.id, jsys.long, jsys.lat, val, function(err, resp) {
                if (err === null)
                    resolve(resp);
                else 
                    resolve(null);
            });
        });
    }

    // Reading from the Redis at the given clock
    async read() {
        let mstone = getCurMilestone();
        let clock = clockFromMilestone(mstone);
        return new Promise((resolve, reject) => {
            this.rs.call('fcall', 'uf_randread', 1, this.key, clock, function(err, resp) {
                if (err === null) {
                    let x = Buffer.from(resp[11], 'base64');
                    resolve(cbor.decode(x));
                } else 
                    resolve(null);
            });
        });
    }

    // setup the read last function.. this returns a promise 
    // that is fulfilled when there is a matching data
    //
    async readLast() {
        return new Promise((resolve, reject) => {
            let cb = function(resp) {
                fltable.delete(this.key);
                let x = Buffer.from(resp[11], 'base64');
                resolve(cbor.decode(x));
            }
            fltable.set(this.key, {callback: cb, type: globals.RedisFuncs.UF_READ_LAST});
        });
    }

    // setup the read first function.. this returns a promise 
    // that is fulfilled when there is a matching data
    //
    async readFirst() {
        return new Promise((resolve, reject) => {
            let cb = function(resp) {
                fltable.delete(this.key);
                let x = Buffer.from(resp[11], 'base64');
                resolve(cbor.decode(x));
            }
            fltable.set(this.key, {callback: cb, type: globals.RedisFuncs.UF_READ_FIRST});
        });
    }
}

/* 
 * Design Thought on dFlow:
 * Multiple readers and single writer. The dFlow is organized into rows that keep moving as they are written (
 * same as uFlow). The rows are driven by jamclock of the writer (in this case the controller). In dFlow the 
 * rows are continuously moving with the writes. So, even if there are no readers picking up the data, the rows 
 * would keep moving. However, the dFlow length (buffered data is something we can configure) ensures that previous 
 * data is available. Each reader has its own read pointer in the stream so it gets continuous data as it keeps reading 
 * irrespective of how other readers are progressing with the stream. The progress (movement of the rows) is solely 
 * dependent on the writer. 
 * 
 * Problem: How do we handle the following situation? We have dFlow with lot of data. However, it is not currently written.
 * Do we want new readers to consume all the old data? 
 * 
 * Rule: an inactive dFlow can have totally outdated data. So, we don't deal with it. Once data arrives, there will be 
 * signalling for that data and would bring the readers. Each reader would see how much data is there in the flow and start processing 
 * all the data - starting from whatever each reader hasn't seen. So, the reader is going to get the older data as well. However,
 * with an active flow, the data is not going to be that old. 
 * 
 * NOTE: We can define dFlow reads or properties in two different ways: read from the tail (newest data) or head (oldest data)
 */
class DFlow {
    constructor(rserv, key) {
        this.rs = rserv;
        this.key = key;
        this.id = myid;
    }

    async write(value) {
        let clock = jsys.getJAMClock();
        return new Promise((resolve, reject) => {
            let cval = cbor.encode(value);
            let val = cval.toString('base64');
            this.rs.call('fcall', 'df_write', 1, this.key, clock, this.id, jsys.long, jsys.lat, val, function(err, resp) {
                if (err === null)
                    resolve(resp);
                else 
                    resolve(null);
            });
        });
    }

    // setup the read tail function.. this returns a promise 
    // that is fulfilled when there is a matching data
    //
    async readTail() {
        return new Promise((resolve, reject) => {
            let cb = function(resp) {
                fltable.delete(this.key);
                let x = Buffer.from(resp[11], 'base64');
                resolve(cbor.decode(x));
            }
            fltable.set(this.key, {callback: cb, type: globals.RedisFuncs.DF_READ_TAIL});
        });
    }

    // setup the read first function.. this returns a promise 
    // that is fulfilled when there is a matching data
    //
    async readHead() {
        let p = new Promise((resolve, reject) => {
            let cb = function(resp) {
                fltable.delete(this.key);
                let x = Buffer.from(resp[11], 'base64');
                resolve(cbor.decode(x));
            }
            fltable.set(this.key, {callback: cb, type: globals.RedisFuncs.DF_READ_HEAD});
        });
        return p;
    }
}

