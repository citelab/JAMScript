const   EventEmitter = require('events'),
        cp = require('child_process');

function RegistrarHead(app, type, id, port, config) {

    this.registrarAbdomen = cp.fork(
        './jregistrar-abdomen.js',
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
    this.registrarAbdomen.send({ setAttributes : attrs });
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
}

/* exports */
module.exports = RegistrarHead;
