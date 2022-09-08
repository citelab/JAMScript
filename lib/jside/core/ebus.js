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
function EventBus(state) 
{
    this.state = state;
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
            case globals.EventName.DATA_UP:
                this.emit(event.data.etype, event.data.info, 1);
            break;
            case globals.EventName.FOG_DATA_DOWN:
            case globals.EventName.CLOUD_DATA_DOWN:
            case globals.EventName.DATA_DOWN:
                this.emit(event.data.etype, 1);
            break;
        }
    }
    this.addListener(globals.EventName.FOG_UP, (id, info, x) => {
        if (x === undefined)
            this.bc.postMessage({etype: globals.EventName.FOG_UP, id: id, info: info});
    });
    this.addListener(globals.EventName.FOG_DOWN, (id, info, x) => {
        if (x === undefined)
            this.bc.postMessage({etype: globals.EventName.FOG_DOWN, id: id, info: info});
    });
    this.addListener(globals.EventName.CLOUD_UP, (id, info, x) => {
        if (x === undefined)
            this.bc.postMessage({etype: globals.EventName.CLOUD_UP, id: id, info: info});
    });
    this.addListener(globals.EventName.CLOUD_DOWN, (id, info, x) => {
        if (x === undefined)
            this.bc.postMessage({etype: globals.EventName.CLOUD_DOWN, id: id, info: info});
    });

    this.addListener(globals.EventName.FOG_DATA_UP, (info, x) => {
        if (x === undefined)
            this.bc.postMessage({etype: globals.EventName.FOG_DATA_UP, info});
    });
    this.addListener(globals.EventName.CLOUD_DATA_UP, (info, x) => {
        if (x === undefined)
            this.bc.postMessage({etype: globals.EventName.CLOUD_DATA_UP, info});
    });
    this.addListener(globals.EventName.DATA_UP, (info, x) => {
        if (x === undefined)
            this.bc.postMessage({etype: globals.EventName.DATA_UP, info});
    });

    this.addListener(globals.EventName.FOG_DATA_DOWN, (x) => {
        if (x === undefined)
            this.bc.postMessage({etype: globals.EventName.FOG_DATA_DOWN});
    });
    this.addListener(globals.EventName.CLOUD_DATA_DOWN, (x) => {
        if (x === undefined)
            this.bc.postMessage({etype: globals.EventName.CLOUD_DATA_DOWN});
    });
    this.addListener(globals.EventName.DATA_DOWN, (x) => {
        if (x === undefined)
            this.bc.postMessage({etype: globals.EventName.DATA_DOWN});
    });

}

EventBus.prototype = Object.create(EventEmitter.prototype);
EventBus.prototype.constructor = EventBus;

EventBus.prototype.close = function()
{
    this.bc.close();
}

EventBus.prototype.onDataUp = function(handler) { this.addListener(globals.EventName.DATA_UP, handler);}
EventBus.prototype.onDataDown = function(handler) { this.addListener(globals.EventName.DATA_DOWN, handler);}
EventBus.prototype.onFogUp = function(handler) { this.addListener(globals.EventName.FOG_UP, handler);}
EventBus.prototype.onFogDown = function(handler) { this.addListener(globals.EventName.FOG_DOWN, handler);}
EventBus.prototype.onFogDataUp = function(handler) { this.addListener(globals.EventName.FOG_DATA_UP, handler);}
EventBus.prototype.onFogDataDown = function(handler) { this.addListener(globals.EventName.FOG_DATA_DOWN, handler);}
EventBus.prototype.onCloudUp = function(handler) { this.addListener(globals.EventName.CLOUD_UP, handler);}
EventBus.prototype.onCloudDown = function(handler) { this.addListener(globals.EventName.CLOUD_DOWN, handler);}
EventBus.prototype.onCloudDataUp = function(handler) { this.addListener(globals.EventName.CLOUD_DATA_UP, handler);}
EventBus.prototype.onCloudDataDown = function(handler) { this.addListener(globals.EventName.CLOUD_DATA_DOWN, handler);}

EventBus.prototype.trigger = function() 
{
    if (this.state.fog === undefined && this.state.cloud === undefined)
        this.emit(globals.EventName.NONE_UP);
    else {
        if (this.state.fog !== undefined)
            this.emit(globals.EventName.FOG_UP, this.state.fog.id, this.state.fog.cinfo);

        if (this.state.cloud !== undefined)
            this.emit(globals.EventName.CLOUD_UP, this.state.cloud.id, this.state.cloud.cinfo);
    }
}

EventBus.prototype.dataUp = function(host, port) 
{
    this.state.data = {host: host, port: port};
    this.emit(globals.EventName.DATA_UP, {host: host, port: port});
}

EventBus.prototype.dataDown = function() 
{
    if (this.state.data === undefined) 
        return;
    this.emit(globals.EventName.DATA_DOWN);
}

EventBus.prototype.fogUp = function(id, cinfo) 
{
    this.state.fog = {id: id, cinfo: cinfo};
    this.emit(globals.EventName.FOG_UP, id, cinfo);
}

EventBus.prototype.fogDown = function(id, info) 
{
    if (this.state.fog === undefined || this.state.fog.id !== id)
        return;
    this.emit(globals.EventName.FOG_DOWN, id, this.state.fog.cinfo);
    this.state.fog = undefined;
}

EventBus.prototype.cloudUp = function(id, cinfo) 
{
    this.state.cloud = {id: id, cinfo: cinfo};
    this.emit(globals.EventName.CLOUD_UP, id, cinfo);
}

EventBus.prototype.cloudDown = function(id, info) 
{
    if (this.state.cloud === undefined || this.state.cloud.id !== id)
        return;

    this.emit(globals.EventName.CLOUD_DOWN, id, this.state.cloud.cinfo);
    this.state.cloud = undefined;
}

// These are specialized ebus events to handle the worker side 
EventBus.prototype.fogDataUp = function(info) 
{
    this.state.fogdata = info;
    this.emit(globals.EventName.FOG_DATA_UP, info);
}

EventBus.prototype.cloudDataUp = function(info) 
{
    this.state.clouddata = info;
    this.emit(globals.EventName.CLOUD_DATA_UP, info);
}

EventBus.prototype.fogDataDown = function() 
{
    this.state.fogdata = undefined;
    this.emit(globals.EventName.FOG_DATA_DOWN);
}

EventBus.prototype.cloudDataDown = function() 
{
    this.state.clouddata = undefined;
    this.emit(globals.EventName.CLOUD_DATA_DOWN);
}

module.exports = new EventBus({cloud: undefined, fog: undefined, data: undefined});