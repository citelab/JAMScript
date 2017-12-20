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
        this.lastValue = null;
        this.messages = [];
        this.clock = 0; //value at the cloud
        this.subClock = 0;  //change value at the fog
        this.transformer = (input) => input;

        if( jammanager.getParentConObject() !== null )
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

        //register this broadcaster with the JAMManager so the broadcaster with the maximum clock can be found
        jammanager.addBroadcaster(this);
    }

    parentUp(obj, parentRedis){
        this._subscribeForBroadcast(obj, parentRedis);
    }

    _subscribeForBroadcast(obj, parentRedis){
        var redis = parentRedis;
        var self = this;
        redis.rawCall(['SUBSCRIBE', this.getSubscriptionDomain()], function(e, resp){
            if( !e && resp[0] == "message" && resp[1] == self.getSubscriptionDomain() )
                self.broadcast(resp[2], false);
        });
    }

    addHook(hook){
        this.hooks.push(hook);
    }

    setTransformer(func){
        if( typeof func === 'function' )
            this.transformer = func;
    }

    getLastValue(){
        return this.lastValue;
    }

    getClock(){
        return this.clock + (this.subClock === 0 ? '' : ',' + this.subClock);
    }

    getMessageAtClock(clockPack){
        let parts = clockPack.split(",");
        let clock = parseInt(parts[0]);
        let subClock = parts.length > 1 ? (parts[1] === "*" ? "*" : parseInt(parts[1])) : 0;

        let messages = [];

        for( let i = this.messages.length - 1; i >= 0; i--){    //start from the current position and go down the array
            let message = this.messages[i];
            if( message.counter.clock == clock ){
                if( subClock === "*" || subClock == message.counter.subClock ) {
                    messages.push(message.message);
                    if( subClock !== "*" )
                        break;
                }
            }
        }

        if( messages.length === 0 )
            return null;
        if( subClock !== "*" )
            return messages[0];
        return messages;
    }

    broadcast(message, fromSelf){
        var msgbuf, mess;
        fromSelf = fromSelf !== false ? true : fromSelf;

        if( fromSelf ){
            if( typeof message === "string" && message.indexOf("{") === 0 )
                message = JSON.parse(message);

            //transform message before sending
            message = this.transformer(message, this);

            this.lastValue = message;

            if( this.jammanager.isCloud )
                this.clock++;
            else if( this.jammanager.isFog )
                this.subClock++;

            //wrap the message in an object with the counter
            message = {
                counter: {
                    clock: this.clock,
                    subClock: this.subClock,
                    from: this.jammanager.deviceID,
                    sourceType: this.jammanager.getLevelCode()
                },
                message: message
            };
            this.messages.push(message);    //save message

            //console.log(message);
        }
        else{   //this can only be a fog or device
            //unwrap message and update broadcaster clock
            if( typeof message === "string" && message.indexOf("{") === 0 )
                message = JSON.parse(message);
            else// if( typeof message !== "object" )
                return; //at this point, all messages should be objects. If it not an object then it must be the cbor encoded message sent from the Fog

            //transform message before sending
            message.message = this.transformer(message.message);

            this.clock = message.counter.clock;
            this.subClock = message.counter.subClock;
            this.messages.push(message);    //save message

            if( typeof message.message === "string" && message.message.indexOf("{") === 0 )
                this.lastValue = JSON.parse(message.message);
            else
                this.lastValue = message.message;
        }

        mess = JSON.stringify(message);
        this._sendMessage(mess, fromSelf);

        if( this.jammanager.isDevice || this.jammanager.isFog ){ //send unwrapped message for devices
            let rawMessage = message.message;
            if( (typeof rawMessage === "object" || (typeof rawMessage === "string" && rawMessage.indexOf("{") === 0)) ){
                rawMessage = cbor.encode(rawMessage);
                msgbuf = Buffer.from(rawMessage);
                rawMessage = msgbuf.toString('base64');
                this._sendMessage(rawMessage, fromSelf);
            }
        }
    }

    _sendMessage(message, fromSelf){
        var channel = this.channel;
        var namespace = this.namespace;
        var app = this.app;
        var broadcaster = this.broadcaster;
        var domain = this.getDomain();
        var hooks = this.hooks;

        var data = {
            channel: channel,
            app: app,
            namespace: namespace,
            domain: domain,
            message: this.lastValue,
            origin: fromSelf ? 'self' : 'parent',
            parent: this.jammanager.getParentConObject(),
            type: this.jammanager.getLevelCode()
        };

//        console.log('Broadcasting ' + message + ' to domain ' + domain + '\n');

        setTimeout(function() {
            hooks.forEach(function(hook){
                hook(data);
            });
            broadcaster.rawCall(['PUBLISH', domain, message]);
        }, 0);
    }

    //This is the default domain which this jambroadcaster is about
    getBroadcastDomain(){
        var channel = this.channel;
        var namespace = this.namespace;
        var app = this.app;
        return 'aps[' + app + '].ns[' + namespace + '].bcasts[' + channel + ']';
    }

    //This is the actual domain on the parent that this broadcaster will subscribe to. It is a mod'd version of the default domain
    //The parent's level code is appended to the default domain.
    //This is done so that same Redis depot can be used for the different levels
    getSubscriptionDomain(){
        var domain = this.getBroadcastDomain();
        switch( this.jammanager.getLevelCode() ){
            case "dev":
            case "device":
                domain += ".fog";
                break;
            case "fog":
                domain += ".cloud";
                break;
        }
        return domain;
    }

    //This is the domain that this broadcaster will publish to, also a mod'd version of the broadcast domain
    //The level code is added to the default domain
    //This is done so that same Redis depot can be used for the different levels
    getDomain(){
        if( this.jammanager.isDevice )
            return this.getBroadcastDomain();

        var domain = this.getBroadcastDomain();
        return domain + '.' + this.jammanager.getLevelCode();
    }
}

module.exports = JAMBroadcaster;
