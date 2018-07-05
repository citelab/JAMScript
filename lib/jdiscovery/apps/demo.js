const   Registrar = require('../jregistrar-head.js'),
        globals = require('../../jamserver/constants').globals,
        events = require('events');

const   id = process.argv[2],
        type = process.argv[3],
        port = process.argv[4],
        app = 'tester';

console.log('_______________________________________________');
console.log(' id: ' + id + ' type: ' + type + ' port: ' + port);
console.log('-----------------------------------------------');
console.log();

// Construct registrar and start it
const   reggie = new Registrar(app, type, id, port,
                           { protocols: { mqtt: false, mdns: true } });
reggie.registerAndDiscover();

// Setup default discoveries
if (type === 'device') {

    reggie.on('fog-up', function(fogId, connInfo) {
        console.log('FOG UP: id: ' + fogId + ', ip: ' + connInfo.ip + ', port: ' + connInfo.port);
    });
    reggie.on('fog-down', function(fogId) {
        console.log('FOG DOWN: id: ' + fogId);
    });
} else if (type === 'fog') {

    reggie.on('cloud-up', function(cloudId, connInfo) {
        console.log('CLOUD UP: id: ' + cloudId + ', ip: ' + connInfo.ip + ', port: ' + connInfo.port);
    });
    reggie.on('cloud-down', function(cloudId) {
        console.log('CLOUD DOWN: id: ' + cloudId);
    });
}

// Setup custom attributes/discoveries
if (type === 'device') {
    const ticker = setInterval(
                reggie.setAttributes,
                5000,
                { secret : Math.random().toString(16) }
    );
    setTimeout(
        (attrs) => {
            clearInterval(ticker);
            reggie.removeAttributes(['secret']);
            reggie.quit();
        },
        22000
    );
} else if (type === 'fog') {
    
    reggie.on('new-secret', function(id, secret) {
        console.log('NEW-SECRET: id: ' + id + ' secret: ' + secret);
    });
    reggie.on('no-more-secret', function(id) {
        console.log('NO-MORE-SECRET: id: ' + id);
    });
    reggie.discoverAttributes({ 
        device: {
            secret: { 
                onAdd : 'new-secret', 
                onRemove : 'no-more-secret' 
            }
        }
    });
}    
