var mqtt = require('mqtt');

var cl = mqtt.connect('mqtt://localhost');

cl.on('connect', function () {
    cl.subscribe('hello', {qos:2, retain:false}, function(err, granted) {
        console.log("Granted", granted);
    });
});

cl.on('message', function(topic, msg) {
    console.log('topic: ', topic);
    console.log('msg: ', msg.toString('utf8'));
});

cl.on('offline', function () {
    console.log("Disconnected..");

});

cl.subscribe('hello');
cl.publish('hello', 'this is a message');
