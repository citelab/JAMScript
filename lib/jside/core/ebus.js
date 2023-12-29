'use strict';
const {
    BroadcastChannel
} = require('worker_threads');
const EventEmitter = require('events');
const globals = require('../utils/constants').globals;

/**
 * EventBus is a mechanism that is going to distribute the events across all workers.
 * A function can subscribe to data up/down (Redis up/down events) or fog/cloud (up/down) or
 * fog-data/cloud-data (up/down) events. These events will be distributed no matter which 
 * worker thread the function is running. So, the event distribution works inside a worker thread 
 * or across multiple worker threads.
 */
function EventBus() 
{
    this.state = {fogpending: [], fogdatapending: [], cloudpending: [], clouddatapending: []};
    this.bc = new BroadcastChannel(globals.ChannelName.EVENT_BUS);
    this.bc.onmessage = (event) => {
        switch (event.data.etype) {
            case globals.EventName.FOG_UP:
            case globals.EventName.FOG_DOWN:
            case globals.EventName.CLOUD_UP:
            case globals.EventName.CLOUD_DOWN:
                this.emit(event.data.etype, event.data.id, event.data.info, 1);
            break;
            case globals.EventName.FOG_DATA_UP:
            case globals.EventName.CLOUD_DATA_UP:
                this.emit(event.data.etype, event.data.id, event.data.info, 1);
            break;
            case globals.EventName.FOG_DATA_DOWN:
            case globals.EventName.CLOUD_DATA_DOWN:
                this.emit(event.data.etype, event.data.id, 1);
            break;
        }
    }
}

EventBus.prototype = Object.create(EventEmitter.prototype);
EventBus.prototype.constructor = EventBus;

EventBus.prototype.close = function()
{
    this.bc.close();
}

EventBus.prototype.onFogUp = function(handler) { this.addListener(globals.EventName.FOG_UP, handler); }
EventBus.prototype.onFogDown = function(handler) { this.addListener(globals.EventName.FOG_DOWN, handler);}
EventBus.prototype.onFogDataUp = function(handler) { this.addListener(globals.EventName.FOG_DATA_UP, handler);}
EventBus.prototype.onFogDataDown = function(handler) { this.addListener(globals.EventName.FOG_DATA_DOWN, handler);}
EventBus.prototype.onCloudUp = function(handler) { this.addListener(globals.EventName.CLOUD_UP, handler);}
EventBus.prototype.onCloudDown = function(handler) { this.addListener(globals.EventName.CLOUD_DOWN, handler);}
EventBus.prototype.onCloudDataUp = function(handler) { this.addListener(globals.EventName.CLOUD_DATA_UP, handler);}
EventBus.prototype.onCloudDataDown = function(handler) { this.addListener(globals.EventName.CLOUD_DATA_DOWN, handler);}

EventBus.prototype.trigger = function() 
{
    this.state.fogpending.forEach((f)=> {
        this.emit(globals.EventName.FOG_UP, f.id, f.cinfo);
    });

    this.state.fogdatapending.forEach((f)=> {
        this.emit(globals.EventName.FOG_DATA_UP, f.id, f.info);
    });

    this.state.cloudpending.forEach((c)=> {
        this.emit(globals.EventName.CLOUD_UP, c.id, c.cinfo);
    });

    this.state.clouddatapending.forEach((c)=> {
        this.emit(globals.EventName.CLOUD_DATA_UP, c.id, c.info);
    });
}

EventBus.prototype.fogUp = function(id, cinfo) 
{
    if (this.listenerCount(globals.EventName.FOG_UP) === 0) 
        this.state.fogpending.push({id: id, cinfo: cinfo});
    else 
        this.emit(globals.EventName.FOG_UP, id, cinfo);
}

EventBus.prototype.fogDown = function(id) 
{
    // no need to do any check .. just pass the message.
    // with multiple fogs.. doing a check is not simple
    this.emit(globals.EventName.FOG_DOWN, id);
}

EventBus.prototype.cloudUp = function(id, cinfo) 
{
    if (this.listenerCount(globals.EventName.CLOUD_UP) === 0) 
        this.state.cloudpending.push({id: id, cinfo: cinfo});
    else 
        this.emit(globals.EventName.CLOUD_UP, id, cinfo);
}

EventBus.prototype.cloudDown = function(id) 
{
    if (this.state.cloud === undefined || this.state.cloud.id !== id)
        return;

    this.emit(globals.EventName.CLOUD_DOWN, id, this.state.cloud.cinfo);
    this.state.cloud = undefined;
}

// These are specialized ebus events to handle the worker side 
EventBus.prototype.fogDataUp = function(id, info) 
{
    if (this.listenerCount(globals.EventName.FOG_DATA_UP) === 0)
        this.state.fogdatapending.push({id: id, info: info});
    else 
        this.emit(globals.EventName.FOG_DATA_UP, id, info);
}

EventBus.prototype.cloudDataUp = function(id, info) 
{
    if (this.listenerCount(globals.EventName.CLOUD_DATA_UP) === 0)
        this.state.clouddatapending.push({id: id, info: info});
    else 
        this.emit(globals.EventName.CLOUD_DATA_UP, id, info);
}

EventBus.prototype.fogDataDown = function(id) 
{
    this.emit(globals.EventName.FOG_DATA_DOWN, id);
}

EventBus.prototype.cloudDataDown = function(id) 
{
    this.emit(globals.EventName.CLOUD_DATA_DOWN, id);
}

EventBus.prototype.emitMsg = function(msg, id) 
{
    this.emit(msg, id);
}

module.exports = new EventBus();