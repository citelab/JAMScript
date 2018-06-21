const   EventEmitter = require('events'),
        RegistrarTail = require('./jregistrar-tail.js');

function RegistrarAbdomen(app, type, id, port, config) {
    
    this.registrarTail = new RegistrarTail(app, type, id, port, config);

    registrarTail.on('discovery', (...) => {
        process.send({...});
    });
    registrarTail.on('attr-removed', (...) => {
        process.send({...});
    });

    process.on('message', (m) => {
        for(f in m)
            if(m.hasOwnProperty(f))
                this.registrarTail[f](m[f]);
    });
}

/* Registrar inherits from EventEmitter */
RegistrarAbdomen.prototype = Object.create(EventEmitter.prototype);
RegistrarAbdomen.prototype.constructor = RegistrarAbdomen;

/* exports */
module.exports = RegistrarAbdomen;
