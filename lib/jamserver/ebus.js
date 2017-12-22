var EventEmitter = require('events');


function EventBus(state) {

    console.log("Hello...", state);
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
    console.log("Emitting... ..data-up");
    
    this.emit('data-up', {host: host, port: port});
}


EventBus.prototype.emitCloudDown = function(id, info) {

    if (this.state.cloud === undefined || this.state.cloud.id !== id)
        return;

    this.emit('cloud-down', id, this.state.cloud.cinfo);
    this.state.cloud = undefined;
}

module.exports = new EventBus({cloud: undefined, fog: undefined, data: undefined});
