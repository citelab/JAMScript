/**
 * Created by Richboy on 03/07/17.
 */

"use strict";

var Redis = require('redis-fast-driver');
var cbor  = require('cbor');
const cmdParser = require('./cmdparser.js');

class JAMBroadcaster{
    constructor(channel, jammanager){
        this.app = cmdParser().app || 'APP';
        this.namespace = 'global';
        this.channel = channel;
        this.jammanager = jammanager;

        if( jammanager.getParentConObject() != null )
            this._subscribeForBroadcast();
        jammanager.addParentUpSub({func: this.parentUp, context: this});   //subscribe each object to parent up connection so it can (re)subscribe for broadcasting

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

    parentUp(obj){
        this._subscribeForBroadcast();
    }

    _subscribeForBroadcast(){
        var redis = this.jammanager.parentRedis;
        var self = this;
        redis.rawCall(['SUBSCRIBE', 'aps[' + this.app + '].ns[' + this.namespace + '].bcasts[' + this.channel + ']'], function(e, resp){
            if( !e && resp[0] == "message" && resp[1] == self.channel )
                broadcast(resp[2]);
        });
    }

    broadcast(message){
        //if broadcasting is from the cloud (or fog), convert to the right format as it travels through the hierarchy
        if( (typeof message == "object" || (typeof message == "string" && message.indexOf(0) == "{")) && this.jammanager.isDevice ){
            message = cbor.encode(message);
            var msgbuf = Buffer.from(message);
            message = msgbuf.toString('base64');
        }
        else if( typeof message == "object" ){
            message = JSON.stringify(message);
        }

        var channel = this.channel;
        var namespace = this.namespace;
        var app = this.app;
        var broadcaster = this.broadcaster;

        setTimeout(function() {
            var domain = 'aps[' + app + '].ns[' + namespace + '].bcasts[' + channel + ']';

            console.log('Broadcasting ' + message + ' to domain ' + domain + '\n');

            broadcaster.rawCall(['PUBLISH', domain, message]);
        }, 0);
    }
}

module.exports = JAMBroadcaster;
