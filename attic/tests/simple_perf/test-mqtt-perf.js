var mqtt = require('mqtt');

tserv = mqtt.connect('tcp://localhost:1883');

tserv.on('connect', function() {

    console.log("Connected...");

    tserv.subscribe('/testtopic');
    console.time("qq");
    tserv.publish('/testtopic', "hello");
    tserv.on('message', function(topic, msg) {
        console.timeEnd("qq");
        console.log("Topic ", topic, "  message  ", msg);
    });
});