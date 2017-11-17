/**
 * Created by Richboy on 03/07/17.
 */

"use strict";

var Redis = require('redis-fast-driver');
var cbor  = require('cbor');
const cmdopts = require('./cmdparser.js');

class JAMBroadcaster{
    constructor(channel, jammanager){
        this.app = cmdopts.app || 'APP';
        this.namespace = 'global';
        this.channel = channel;
        this.jammanager = jammanager;
        this.hooks = [];

        if( jammanager.getParentConObject() != null )
            this._subscribeForBroadcast(jammanager.getParentConObject(), jammanager.getParentRedis());
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

    parentUp(obj, parentRedis){
        this._subscribeForBroadcast(obj, parentRedis);
    }

    _subscribeForBroadcast(obj, parentRedis){
        var redis = parentRedis;
        var self = this;
        redis.rawCall(['SUBSCRIBE', 'aps[' + this.app + '].ns[' + this.namespace + '].bcasts[' + this.channel + ']'], function(e, resp){
            if( !e && resp[0] == "message" && resp[1] == self.channel )
                self.broadcast(resp[2], false);
        });
    }

    addHook(hook){
        this.hooks.push(hook);
    }

    broadcast(message, fromSelf){
        var mess, msgbuf;
        fromSelf = fromSelf !== false ? true : fromSelf;

        //if broadcasting is from the cloud (or fog), convert to the right format as it travels through the hierarchy
        if( (typeof message == "object" || (typeof message == "string" && message.indexOf(0) == "{")) ){
            if( this.jammanager.isDevice ){
                message = cbor.encode(message);
                msgbuf = Buffer.from(message);
                message = msgbuf.toString('base64');
            }
            else if( this.jammanager.isFog ){
                mess = cbor.encode(message);
                msgbuf = Buffer.from(mess);
                mess = msgbuf.toString('base64');

                this._sendMessage(mess);    //send the first message stream

                if( typeof message == "object" )
                    message = JSON.stringify(message);  //stringify for the second stream
            }
            else if( typeof message == "object" )
                message = JSON.stringify(message);
        }

        this._sendMessage(message, fromSelf);
    }

    _sendMessage(message, fromSelf){
        var channel = this.channel;
        var namespace = this.namespace;
        var app = this.app;
        var broadcaster = this.broadcaster;
        var domain = 'aps[' + app + '].ns[' + namespace + '].bcasts[' + channel + ']';
        var hooks = this.hooks;

        var data = {
            channel: channel,
            app: app,
            domain: domain,
            message: message,
            origin: fromSelf ? 'self' : 'parent',
            parent: this.jammanager.getParentConObject()
        }

        console.log('Broadcasting ' + message + ' to domain ' + domain + '\n');

        setTimeout(function() {
            hooks.forEach(function(hook){
                hook(data);
            });
            broadcaster.rawCall(['PUBLISH', domain, message]);
        }, 0);
    }
}

module.exports = JAMBroadcaster;
