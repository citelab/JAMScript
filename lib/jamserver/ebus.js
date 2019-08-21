var EventEmitter = require('events');


function EventBus(state) {
    this.state = state;
}

EventBus.prototype = Object.create(EventEmitter.prototype);
EventBus.prototype.constructor = EventBus;


EventBus.prototype.trigger = function() {

    if (this.state.fog !== undefined)
        this.emit('fog-up', this.state.fog.id, this.state.fog.cinfo);

    if (this.state.cloud !== undefined)
        this.emit('cloud-up', this.state.cloud.id, this.state.cloud.cinfo);
}

EventBus.prototype.emitFogUp = function(id, cinfo) {

    this.state.fog = {id: id, cinfo: cinfo};
    console.log("Emiting. fog up.....................");
    this.emit('fog-up', id, cinfo);
}

EventBus.prototype.emitFogDown = function(id, info) {

    if (this.state.fog === undefined || this.state.fog.id !== id)
        return;

    this.emit('fog-down', id, this.state.fog.cinfo);
    this.state.fog = undefined;
}

EventBus.prototype.emitCloudUp = function(id, cinfo) {

    this.state.cloud = {id: id, cinfo: cinfo};
    this.emit('cloud-up', id, cinfo);
}

EventBus.prototype.dataUp = function(host, port) {

    this.state.data = {host: host, port: port};
    this.emit('data-up', {host: host, port: port});
}

EventBus.prototype.dataDown = function() {

    if (this.state.data === undefined) 
        return;
    this.emit('data-down');
}

EventBus.prototype.emitCloudDown = function(id, info) {

    if (this.state.cloud === undefined || this.state.cloud.id !== id)
        return;

    this.emit('cloud-down', id, this.state.cloud.cinfo);
    this.state.cloud = undefined;
}

// These are specialized ebus events to handle the worker side 
EventBus.prototype.fogDataUp = function(info) {

    this.state.fogdata = info;
    this.emit('fog-data-up', info);
}

EventBus.prototype.cloudDataUp = function(info) {

    this.state.clouddata = info;
    console.log("Emiting cloud data up....");
    this.emit('cloud-data-up', info);
}

EventBus.prototype.fogDataDown = function() {

    this.state.fogdata = undefined;
    this.emit('fog-data-down');
}

EventBus.prototype.cloudDataDown = function() {

    this.state.clouddata = undefined;
    this.emit('cloud-data-down');
}


module.exports = new EventBus({cloud: undefined, fog: undefined, data: undefined});
