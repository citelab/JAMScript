var Registrar = require('../jregistrar'),
    errLog = require('../../jamserver/jerrlog'),
    globals = require('../../jamserver/constants').globals,
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

var reggie = new Registrar(app, machType, id, port, {mqtt:true, mdns:true, localStorage:false});

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

/*    reggie.on('fog-down', function(fogId) {
        console.log('FOG DOWN: id: ' + fogId);
    });

    reggie.on('cloud-down', function(fogId) {
        console.log('CLOUD DOWN: id: ' + fogId);
    });
*/


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

if (machType === globals.NodeType.FOG)
    setInterval(reggie.addAttributes, 500, {zone2: id});

if (machType === globals.NodeType.DEVICE)
{
	reggie.discoverAttributes({
	    fog: {
		zone2: 'zoneinfo'
	    }
	});

    reggie.on('zoneinfo', function() {
	console.log("Hello....in zone2");
    });
}



setInterval(function() {
    console.log("Checking...");

    
}, 1000);
