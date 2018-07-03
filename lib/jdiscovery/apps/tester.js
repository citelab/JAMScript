var Registrar = require('../jregistrar-head.js'),
globals = require('../../jamserver/constants').globals,
events = require('events');

var id = process.argv[2],
type = process.argv[3],
port = process.argv[4],
app = 'tester';

console.log('_______________________________________________');
console.log(' id: ' + id + ' type: ' + type + ' port: ' + port);
console.log('-----------------------------------------------');
console.log();

var reggie = new Registrar(app, type, id, port,
                           { protocols: { mqtt: false, mdns: true } });
reggie.registerAndDiscover();

// Default discoveries
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
// on rare occasions, you might get an error
reggie.on('error', function(err) {
    console.log("TESTER: Registrar threw an error...");    
});

// Custom attributes/discoveries
if (type === 'device') {
    let i = 0;
    let f = (x) => {
        reggie.setAttributes({ secret : Math.random().toString(16) });
        ++i;
        if(i < 5) {
            setTimeout(f, 10000);
        } else {
            reggie.removeAttributes({secret : null});
            reggie.quit();
        }
    }
    f();
} else if (type === 'fog') {
    
    reggie.on('new-secret', function(id, secret) {
        console.log('NEW-SECRET: id: ' + id + ' secret: ' + secret);
//        reggie.getDiscoveryTable((x) => console.log(JSON.stringify(x)));
    });
    reggie.on('no-more-secret', function(id) {
        console.log('NO-MORE-SECRET: id: ' + id);
    });
    reggie.discoverAttributes({ device: { secret: { onAdd : 'new-secret', onRemove : 'no-more-secret' }}});
}    
