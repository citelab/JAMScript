/**
 * Created by Richboy on 03/07/17.
 */

"use strict";

var Redis = require('redis-fast-driver');
var cbor  = require('cbor');

class JAMBroadcaster{
    constructor(name, jammanager){
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

    bcast(message){
        if(typeof message == "object"){
            message = cbor.encode(message);
        }

        setTimeout(function() {
            var namespace = 'global';
            var name = this.name;
            var parts = this.name.split('.');
            if (parts.length > 1) {
                namespace = parts[0];
                name = parts[1];
            }
            var domain = 'apps[' + app + '].namespaces[' + namespace + '].broadcasters[' + name + ']';

            console.log('Broadcasting ' + message + ' to domain ' + domain + '\n');

            this.broadcaster.rawCall(['PUBLISH', domain, message]);
        }, 0);
    }
}

module.exports = JAMBroadcaster;