'use strict';

const {
    Worker, isMainThread, MessageChannel, workerData, BroadcastChannel
} = require('worker_threads');
const globals = require('../utils/constants').globals;

/**
 * The minicore module that bootstraps the whole system
 */
module.exports = new function()
{
    this.init = function (app, libs) {
        this.app = app;
        this.libs = libs;
        this.appchannel = new BroadcastChannel(globals.ChannelName.APP_LIBRARY);
    };
    this.run = function() {
        var that = this;
        return new Promise(function(resolve, reject)
        {
            if (isMainThread) {
                // start the center of the minicore
                that.aport = createApplication(that.app);
                that.lports = createLibrary();
                checkPort(that.aport, that.lports, function(res) {
                    if (res)
                        resolve({app: that.aport, appchannel: that.appchannel});
                    else
                        reject(false);
                });
            } else {
                // start the legs of the minicore
                // they are all run by external scripts
            }
        });
    }

    return this;
}


function createApplication(appfile)
{
    const {port1, port2} = new MessageChannel();
    const app = new Worker(appfile, {workerData: {type: globals.WorkerType.APPLICATION, port: port2}, transferList: [port2]});
    return port1;
}

function createLibrary(libfile)
{
    if (libfile !== undefined) {
        const {port1, port2} = new MessageChannel();
        const lib = new Worker(libfile, {workerData: {type: globals.WorkerType.LIBRARY, port: port2}, transferList: [port2]});
        return port1;
    } else 
        return [];
}

// We check whether the app and scheduler threads are running
// They should be sending the "READY" messages to the main thread
function checkPort(app, lib, callback)
{
    app.once('message', function(x) {
        if (x.cmd === "READY")
            callback(true);
    });

    if (lib.length > 0) {
        lib.once('message', function(x) {
        }); 
    }
}
