    var Registrar = require('./jregistrar'),
        globals = require('../jside/utils/constants').globals,
        events = require('events');
    const {Random, MersenneTwister19937} = require('random-js');

    var random = new Random(MersenneTwister19937.autoSeed());

    var machType = process.argv[2],
        phoneType = process.argv[3],
        phoneNumber = process.argv[4],
        app = 'keithTest',
        port = 1337,
        loc = 3434.34,
        id = random.uuid4();

    
    console.log('_______________________________________________');
    console.log(machType + ' id: ' + id);
    console.log('-----------------------------------------------');
    console.log();

    var reggie = new Registrar(app, machType, id, port, loc);

    //------------------------------------------------------------------------------
    // Default discoveries
    //------------------------------------------------------------------------------

    if (machType === 'device') {
        reggie.on('fog-up', function(fogId, connInfo) {
            console.log('FOG UP: id: ' + fogId + ', ip: ' + connInfo.ip + ', port: ' + connInfo.port + ', loc: ' + connInfo.loc);
        });

        reggie.on('fog-down', function(fogId) {
            console.log('FOG DOWN: id: ' + fogId);
        });
    } else if (machType === 'fog') {
        reggie.on('cloud-up', function(cloudId, connInfo) {
            console.log('CLOUD UP: id: ' + cloudId + ', ip: ' + connInfo.ip + ', port: ' + connInfo.port);

        });

        reggie.on('cloud-down', function(cloudId) {
            console.log('CLOUD DOWN: id: ' + cloudId);
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

            var i = 0;
            // in 10 seconds, turn this android into an iphone
            setInterval(function() {
                reggie.removeAttributes('android');
                reggie.removeAttributes('iPhone');
                reggie.addAttributes({
                    iPhone: phoneNumber + i
                });
                i++;
            }, 1000);
        }

        reggie.discoverAttributes({
            fog: {
                location: {
                    onAdd: 'location-added',
                    onRemove: 'location-removed'
                }
            }
        });


        reggie.on('location-added', function(id, loc) {
            console.log('FOG ' + id + ' location is ' + loc);
        });
        //setInterval(reggie.addAttributes, 1000, { thermostat: 10 });
    } else if (machType === 'fog') {
        // since we'll have clouds discover fogs, we don't need fogs to discover clouds
       // reggie.stopDiscoveringAttributes({
            //cloud: ['status']
        //});

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

        var x;
        setInterval(function() {
            x = Math.random() * 100;
            reggie.changeAttributes({location: x});
        }, 1000)
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

    reggie.registerAndDiscover();

