var Registrar = require('../jregistrar'),
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
                           { protocols: { mqtt: true, mdns: true } });

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
    let f = (x) => {
        reggie.setAttributes({ secret : Math.random().toString(16) });
        setTimeout(f, 5000);
    }
    f();
} else if (type === 'fog') {
    reggie.on('new-secret', function(id, secret) {
        console.log('NEW-SECRET: id: ' + id + ' secret: ' + secret);
    });
    reggie.on('no-more-secret', function(id) {
        console.log('NO-MORE-SECRET: id: ' + id);
    });
    reggie.discoverAttributes({ device: { secret: { onAdd : 'new-secret', onRemove : 'no-more-secret' }}});
}    
/*

if (machType === 'device') {
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
    }, 5000);
}
reggie.addAttributes({
    thermostat: function() {
	// returns some random number, which we'll treat as the temperature
	return 'Temperature: ' + Math.random() * 100;
    }
});
} else if (machType === 'fog') {
// since we'll have clouds discover fogs, we don't need fogs to discover clouds
reggie.stopDiscoveringAttributes({
    cloud: ['status']
});

reggie.discoverAttributes({
    device: {
	thermostat: {
	    onAdd: 'thermo-added',
	    onRemove: 'thermo-removed'
	}
    }
});

reggie.on('thermo-added', function(id, temp) {
    console.log('DEVICE ' + id + ' is a thermostat with temperature ' + temp);
});

reggie.on('thermo-removed', function(id, temp) {
    console.log('DEVICE ' + id + ' is no longer a thermostat');
});
} else {
// maybe clouds want to discover fogs, and iphone devices
reggie.discoverAttributes({
    device: {
	iPhone: {
	    onAdd: 'iPhone-added',
	    onRemove: 'iPhone-removed'
	},
	android: {
	    onAdd: 'android-added',
	    onRemove: 'android-removed'
	}
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

reggie.on('iPhone-added', function(deviceId, phoneNumber) {
    console.log('DEVICE ' + deviceId + ' is an iPhone with number ' + phoneNumber);
});

reggie.on('iPhone-removed', function(deviceId) {
    console.log('DEVICE ' + deviceId + ' is no longer an iPhone');
});

reggie.on('android-added', function(deviceId, phoneNumber) {
    console.log('DEVICE ' + deviceId + ' is an Android with number: ' + phoneNumber);
});

reggie.on('android-removed', function(deviceId) {
    console.log('DEVICE ' + deviceId + ' is no longer an Android');
});
}
*/
reggie.registerAndDiscover();
