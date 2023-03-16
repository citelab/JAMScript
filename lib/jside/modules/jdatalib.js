const Redis = require('ioredis');
const cbor = require('cbor-x');
const globals = require('../utils/constants').globals;

/*
 * NOTE: See all the notes in the jredlib.lua file - this is the Redis Functions library 
 * One key assumption is that no through-the-store traffic. For example, devices do not push 
 * any traffic through the Redis stores at the fog to the cloud. Any such traffic is actually
 * relayed by the fog. 
 * 
 * The old version had automatic relaying at the data store level - one less feature!
 */

let fltable = new Map();
let myid;

module.exports = {
    createRedis,
    configureRedis,
    getId,
    createDFlow,
    createUFlow
}

async function createRedis(host, port) {
    let state = 0;
    let p = new Promise((resolve, reject) => {
        //let r = new Redis({host: host, port: port});
        resolve("hello....");
        /*
        
        r.on('ready', function() {
            state = 1;
        });
        r.on('connect', function() {
            if (state === 1) {
                resolve(r);
            }
        });
        r.on('error', function() {
            reject(state);
        });
        r.on('disconnect', function(){
            console.log('redis disconnected');
        });
        r.on('reconnecting', function(num){
            console.log('redis reconnecting with attempt #' + num);
        });
        */
    });
    return p;
}

async function configureRedis(main, host, port, uid) {
    console.log("----------- A", host, port, uid);
    let listen = await createRedis(host, port);
    console.log("----------- B");
    myuid = uid;
    myid = await getId(main, uid);
    console.log("----------- C");
    await __configureListener(main, listen, myid);
    console.log("----------- D");
    let lib = await checkRedisLib(main);
    console.log("----------- E");
    if (lib)
        return true;
    else {
        console.log("ERROR! Redis Library not found...");
        process.exit(1);
    }
}

async function createUFlow(rs, key) {
    return new UFlow(rs, key);
}

async function createDFlow(rs, key) {
    return new DFlow(rs, key);
}



async function __configureListener(r, l, myid) {
    return new Promise((resolve, reject) => {
        r.rawCall(['config', 'set', 'notify-keyspace-events', 'KEA']);
        l.rawCall(['psubscribe', '__keyevent*'], function(err, resp) {
            if (resp[3] !== undefined) {
                let key = resp[3].split("###")[0];
                let entry = fltable.get(key);
                if (entry !== undefined) {
                    let cmd;
                    switch (entry.type) {
                        case globals.RedisFuncs.UF_READ_FIRST:
                            cmd = ['fcall', 'uf_fread', 1, key];
                        break;
                        case globals.RedisFuncs.UF_READ_LAST:
                            cmd = ['fcall', 'uf_lread', 1, key];
                        break;
                        case globals.RedisFuncs.DF_READ_TAIL:
                            cmd = ['fcall', 'df_tread', 1, key];
                        break;
                        case globals.RedisFuncs.DF_READ_HEAD:
                            cmd = ['fcall', 'df_hread', 1, key, myid];
                        break;
                    }
                    r.rawCall(cmd, function(err, res) {
                        if (err === null)
                            entry.callback(res);
                    });
                }
            }
        });
        resolve(true);
    });
}

// return true if the Redis Functions are loaded.. check for given names
async function checkRedisLib(rserv) {
    return new Promise((resolve, reject) => {
        let cmd = ['function', 'list', 'libraryname', 'jredlib'];
        rserv.rawCall(cmd, function(err, resp) {
            if (err === null)
                resolve(true);
            else 
                reject("jredlib Not Found");
        });
    });
}

// get the unique sequence identifier (this unique) with in the red server
async function getId(rserv, uid) {
    return new Promise((resolve, reject) => {
        console.log("---------------------------- getid ", uid);
        let cmd = ['fcall', 'get_id', 0, uid];
        rserv.rawCall(cmd, function(err, resp) {
            if (err === null)
                resolve(resp);
            else 
                resolve(null);
        });
    });
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
    constructor(rserv, key, jsys) {
        this.rs = rserv;
        this.key = key;
        this.id = myid;
        this.jsys = jsys;
    }

    async write(value) {
        let scope = getCurScope();
        let mstone = getCurMilestone();
        let clock = clockFromMilestone(mstone);
        return new Promise((resolve, reject) => {
            let cmd = ['fcall', 'uf_write', 1, this.key, clock, this.id, scope, jsys.long, jsys.lat];
            let cval = cbor.encode(value);
            cmd.push(cval.toString('base64'));
            this.rs.rawCall(cmd, function(err, resp) {
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
            let cmd = ['fcall', 'uf_randread', 1, this.key, clock];
            this.rs.rawCall(cmd, function(err, resp) {
                if (err === null)
                    resolve(resp);
                else 
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
                resolve(resp);
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
                resolve(resp);
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
    constructor(rserv, key, jsys) {
        this.rs = rserv;
        this.key = key;
        this.id = myid;
        this.jsys = jsys;
    }

    async write(value) {
        let scope = getCurScope();
        let mstone = getCurMilestone();
        let clock = clockFromMilestone(mstone);
        return new Promise((resolve, reject) => {
            let cmd = ['fcall', 'df_write', 1, this.key, clock, this.id, scope, jsys.long, jsys.lat];
            let cval = cbor.encode(value);
            cmd.push(cval.toString('base64'));
            this.rs.rawCall(cmd, function(err, resp) {
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
                resolve(resp);
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
                resolve(resp);
            }
            fltable.set(this.key, {callback: cb, type: globals.RedisFuncs.DF_READ_HEAD});
        });
        return p;
    }
}

