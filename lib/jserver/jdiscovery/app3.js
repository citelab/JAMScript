var Registrar = require('./jregistrar'),
    errLog = require('../jerrlog'),
    globals = require('../constants').globals,
    events = require('events'),
    Random = require('random-js');

var random = new Random(Random.engines.mt19937().autoSeed());

var machType = process.argv[2],
    phoneType = process.argv[3],
    phoneNumber = process.argv[4],
    app = 'myApp2',
    port = 1337,
    id = random.uuid4();

// don't forget to initialize the logger!
errLog.init(app, false);

console.log('_______________________________________________');
console.log(machType + ' id: ' + id);
console.log('-----------------------------------------------');
console.log();

var reggie = new Registrar(app, machType, id, port);

//------------------------------------------------------------------------------
// Default discoveries
//------------------------------------------------------------------------------

if (machType === globals.NodeType.DEVICE) {

    reggie.on('fog-up', function(fogId, connInfo) {
        console.log('FOG UP: id: ' + fogId + ', ip: ' + connInfo.ip + ', port: ' + connInfo.port);
    });

    reggie.on('cloud-up', function(fogId, connInfo) {
        console.log('CLOUD UP: id: ' + fogId + ', ip: ' + connInfo.ip + ', port: ' + connInfo.port);
    });

    reggie.on('fog-down', function(fogId) {
        console.log('FOG DOWN: id: ' + fogId);
    });

    reggie.on('cloud-down', function(fogId) {
        console.log('CLOUD DOWN: id: ' + fogId);
    });

} else if (machType === globals.NodeType.FOG) {

    reggie.on('cloud-up', function(cloudId, connInfo) {
        console.log('CLOUD UP: id: ' + cloudId + ', ip: ' + connInfo.ip + ', port: ' + connInfo.port);

    });

    reggie.on('cloud-down', function(cloudId) {
        console.log('CLOUD DOWN: id: ' + cloudId);
    });
} else if (machType === globals.NodeType.CLOUD) {

}

// on rare occasions, you might get an error
reggie.on('error', function(err) {
    switch(err.name) {
        case 'permissions_err':
            console.log(err.message);
            console.log('Subscriptions: ' + err.value);
            break;
        default:
            console.log('unknown error');
            break;
    }
});


reggie.registerAndDiscover();


setInterval(function() {
    console.log("Checking...");

    reggie.on('fog-up', function(fogId, connInfo) {
        console.log('FOG UP: id: ' + fogId + ', ip: ' + connInfo.ip + ', port: ' + connInfo.port);
    });

    reggie.on('cloud-up', function(fogId, connInfo) {
        console.log('CLOUD UP: id: ' + fogId + ', ip: ' + connInfo.ip + ', port: ' + connInfo.port);
    });

    reggie.on('fog-down', function(fogId) {
        console.log('FOG DOWN: id: ' + fogId);
    });

    reggie.on('cloud-down', function(fogId) {
        console.log('CLOUD DOWN: id: ' + fogId);
    });

    
}, 1000);
