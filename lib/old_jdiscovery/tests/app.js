var Registrar = require('../jregistrar'),
    errLog = require('../../jamserver/jerrlog'),
    globals = require('../../jamserver/constants').globals,
    events = require('events'),
    Random = require('random-js');

var random = new Random(Random.engines.mt19937().autoSeed());

var machType = process.argv[2],
    phoneType = process.argv[3],
    phoneNumber = process.argv[4],
    app = 'myApp',
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

reggie.on('cloud-up', function(fogId, connInfo) {
    console.log('CLOUD UP: id: ' + fogId + ', ip: ' + connInfo.ip + ', port: ' + connInfo.port);
});

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

    console.log("---------------------------------------------");
//    reggie.on('cloud-up', function(cloudId, connInfo) {
//        console.log('CLOUD UP: id: ' + cloudId + ', ip: ' + connInfo.ip + ', port: ' + connInfo.port);

  //  });

//    reggie.on('cloud-down', function(cloudId) {
  //      console.log('CLOUD DOWN: id: ' + cloudId);
//    });
} else if (machType === globals.NodeType.CLOUD) {
	reggie.on('cloud-up', function(cloudId, connInfo) {
		console.log('CLOUD UP.....');
	});
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

//------------------------------------------------------------------------------
// Custom attributes/discoveries
//------------------------------------------------------------------------------

if (machType === globals.NodeType.DEVICE) {
    // we'll have devices announce if they are phones (iphone or android)
    // we'll say all devices are thermostats too...I know it doesn't make sense but it's just meant
    // to be demonstrative :P
    if (phoneType === 'iPhone') {
        reggie.addAttributes({
            iPhone: phoneNumber
        });
    } else if (phoneType === 'Android') {
        reggie.addAttributes({
            android: 'psych, get an iPhone!'
        });

        // in 10 seconds, turn this android into an iphone
        setTimeout(function() {
            reggie.removeAttributes('android');
            reggie.addAttributes({
                iPhone: phoneNumber
            });
        }, 1000);
    }
    reggie.addAttributes({
        thermostat: function() {
            // returns some random number, which we'll treat as the temperature
            return Math.random() * 100;
        }
    });
} else if (machType === globals.NodeType.FOG) {
    // since we'll have clouds discover fogs, we don't need fogs to discover clouds
//    reggie.stopDiscoveringAttributes({
  //      cloud: ['status']
//    });

  //  reggie.discoverAttributes({
    //    device: {
      //      thermostat: 'thermo'
//        }
  //  });

    reggie.on('thermo', function(id, temp) {
        console.log('DEVICE ' + id + ' is a thermostat with temperature ' + temp);
    });
} else {
    // maybe clouds want to discover fogs, and iphone devices
    reggie.discoverAttributes({
        device: {
            iPhone: 'iPhone',
            android: 'android'
        },
        fog: {
            status: {
                online: 'fog-up',
                offline: 'fog-down'
            }
        }
    });

    reggie.on('fog-up', function(fogId, connInfo) {
        console.log('FOG UP: id: ' + fogId + ', ip: ' + connInfo.ip + ', port: ' + connInfo.port);
    });

    reggie.on('fog-down', function(fogId) {
        console.log('FOG DOWN: id: ' + fogId);
    });

    reggie.on('iPhone', function(deviceId, phoneNumber) {
        console.log('DEVICE ' + deviceId + ' is an iPhone with number ' + phoneNumber);
    });

    reggie.on('android', function(deviceId, phoneNumber) {
        console.log('DEVICE ' + deviceId + ' is an Android with number ' + phoneNumber);
    })
}

reggie.registerAndDiscover();
