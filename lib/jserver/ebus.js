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

EventBus.prototype.emitFogDown = function(id) {

    this.state.fog = undefined;
    this.emit('fog-down', id);
}

EventBus.prototype.emitCloudUp = function(id, cinfo) {

    this.state.cloud = {id: id, cinfo: cinfo};
    this.emit('cloud-up', id, cinfo);
}

EventBus.prototype.emitCloudDown = function(id) {

    this.state.fog = undefined;
    this.emit('cloud-down', id);
}

module.exports = EventBus;
