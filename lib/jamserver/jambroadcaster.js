/**
 * Created by Richboy on 03/07/17.
 */

"use strict";

var Redis = require('redis-fast-driver');
var cbor  = require('cbor');
const cmdParser = require('./cmdparser.js');

class JAMBroadcaster{
    constructor(name, jammanager){
        this.app = cmdParser().app || 'APP';
        this.namespace = 'global';
        this.name = name;


        this.broadcaster = JAMBroadcaster.broadcaster ? JAMBroadcaster.broadcaster : new Redis({
            host: jammanager.host,
            port: jammanager.port
        });

        //let all instances of the broadcaster share same Redis connection
        if( !JAMBroadcaster.broadcaster )
            JAMBroadcaster.broadcaster = this.broadcaster;

        this.broadcaster.rawCall(['config', 'set', 'protected-mode', 'no']);

        //TODO we need to detect if this is running on a fog and then if we need to subscribe to a domain on the cloud
        /*
            TODO we should receive all the subscriptions from the devices and subscribe to them on the cloud if this is
            a fog so that on receipt, we can further broadcast to the interested devices. or we subscribe to every channel
            on the cloud and further propagate to the devices
         */
    }

    broadcast(message){
        if(typeof message == "object"){
            var tmp;
            Object.keys(message).forEach(function(k){
               if(typeof message[k] == "string"){
                    tmp["s"+k] = message[k];
               } 
               else if(typeof message[k] == "number" && parseInt(message[k]) != message[k]){
                    tmp["f"+k] = message[k];
               }
               else if(typeof message[k] == "number") 
                    tmp["d"+k] = message[k];
            });
            //console.log(tmp);
            message = cbor.encode(tmp);
            //console.log(message);
        }
        var name = this.name;
        var namespace = this.namespace;
        var app = this.app;
        var broadcaster = this.broadcaster;

        setTimeout(function() {
            
            var domain = 'apps[' + app + '].namespaces[' + namespace + '].broadcasters[' + name + ']';

            console.log('Broadcasting ' + message + ' to domain ' + domain + '\n');

            broadcaster.rawCall(['PUBLISH', domain, message]);
        }, 0);
    }
}

module.exports = JAMBroadcaster;