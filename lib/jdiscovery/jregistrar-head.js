const   EventEmitter = require('events'),
        cp = require('child_process');

function RegistrarHead(app, type, id, port, config) {

    this.registrarAbdomen = cp.fork(
        __dirname + '/jregistrar-abdomen.js',
        [app, type, id, port, JSON.stringify(config)]
    );
    let self = this;
    this.registrarAbdomen.on('message', (m) => {
        let e;
        if(m.hasOwnProperty('appNotifLess')) {
            e = m['appNotifLess'];
            self.emit(e.event, e.id, e.protocol);
        } else if(m.hasOwnProperty('appNotifMore')) {
            e = m['appNotifMore'];
            self.emit(e.event, e.id, e.data, e.protocol);
        } else if(m.hasOwnProperty('discoveryTable')) {
            if((typeof self.discoveryTableHandler) === 'function')
                self.discoveryTableHandler(JSON.parse(m['discoveryTable']));
        }
    });
}

/* Registrar inherits from EventEmitter */
RegistrarHead.prototype = Object.create(EventEmitter.prototype);
RegistrarHead.prototype.constructor = RegistrarHead;

/**
 * REGISTRAR INTERFACE METHODS
 * __JDISCOVERY_EXTERNAL_API__
 */

RegistrarHead.prototype.registerAndDiscover = function(options) {
    this.registrarAbdomen.send({ registerAndDiscover : ((options)?(options):null) });
}

RegistrarHead.prototype.setAttributes = function(attrs) {
    // N.B. Gotta clone attrs to avoid some crazy JS shit...
    // Evaluate attr function to get value 
    // ... right before sending over to other process
    let clone = {};
    for(const key in attrs) {
        if(attrs.hasOwnProperty(key)) {
            if(typeof attrs[key] === 'function') {
                clone[key] = attrs[key]();
            } else {
                clone[key] = attrs[key];
            }
        }
    }
    this.registrarAbdomen.send({ setAttributes : clone });
}
RegistrarHead.prototype.removeAttributes = function(attrs) {
    this.registrarAbdomen.send({ removeAttributes : attrs });
}

RegistrarHead.prototype.discoverAttributes = function(dattrs) {
    this.registrarAbdomen.send({ discoverAttributes : dattrs });
}
RegistrarHead.prototype.stopDiscoveringAttributes = function(dattrs) {
    this.registrarAbdomen.send({ stopDiscoveringAttributes : dattrs });
}

RegistrarHead.prototype.quit = function() {
    this.registrarAbdomen.send({ quit : null });
    setTimeout(
        (s) => { this.registrarAbdomen.kill(s); },
        3000,
        'SIGTERM'
    );
}

RegistrarHead.prototype.getDiscoveryTable = function(handler) {
    this.discoveryTableHandler = handler;
    this.registrarAbdomen.send({ getDiscoveryTable : null });
}

/* exports */
module.exports = RegistrarHead;
