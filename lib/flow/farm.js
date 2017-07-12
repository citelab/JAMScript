/**
 * Created by Richboy on 04/07/17.
 */

"use strict";

(function(){
    var cluster = require('cluster');
    var isMaster = cluster.isMaster;
    var totalCores = require('os').cpus().length;
    var workers = [];
    var position = 0;   //we will be using a round robin format to process the data. This will be the position of the worker
    var listeners = {}; //key-value pair of keys (jobID) and an array of those listening on the keys
    var initialized = false;
    var totalOnline = 0;


    function messageHandler(worker, message){
        //console.log("message from worker: " + worker.id + " in Process: " + worker.process.pid);
        for( let listener of listeners["job" + message.jobID] )
            listener.notify(worker, message);
    }

    function onlineHandler(){
        totalOnline++;
    }


    var Farm = {
        init: function(cores){
            if( initialized )
                return;

            if( !cores )
                cores = 1;

            initialized = true;

            cluster.setupMaster({
                exec: '../worker.js'   //'worker.js'
            });

            var worker;

            for(let i = 0; i < Math.min(cores, totalCores); i++) {
                worker = cluster.fork();
                workers.push(worker);

                worker.on("online", onlineHandler);
            }

            cluster.on("message", messageHandler);
        },
        isMaster: isMaster,
        getWorkers: () => workers,
        getTotalWorkersOnline: () => totalOnline,
        getTotalWorkers: () => workers.length,
        totalCores: totalCores,
        subscribe: function(jobID, listener){
            if( !listeners["job" + jobID] )
                listeners["job" + jobID] = [];

            if( listeners["job" + jobID].indexOf(listener) == -1 )
                listeners["job" + jobID].push(listener);
        },
        unsubscribe: function(jobID, listener){
            if( !listeners["job" + jobID] )
                return;

            var index = listeners["job" + jobID].indexOf(listener);
            if( index <= 0 )
                return;

            listeners["job" + jobID].splice(index, 1);
        },
        send: function(bundle){
            try{
                workers[position].send(bundle);
            }
            finally{
                position = (position + 1) % workers.length;
            }
        },
        broadcast: function(bundle){
            for( let worker of workers )
                worker.send(bundle);
        }
    };

    module.exports = Farm;
})();