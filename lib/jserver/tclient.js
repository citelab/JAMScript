var mqtt = require('mqtt');
var tserv = mqtt.connect("mqtt://localhost");

function checkMQTTServer(callback) {
	var tserv = mqtt.connect("mqtt://localhost");
	tserv.on('connect', function () {
		callback(true);
		tserv.end();
	})
	tserv.on('offline', function() {
		callback(false);
		tserv.end();
	})
}


checkMQTTServer(function(connected) {
    if (connected)
        console.log("MQTT server is present");
    else
        console.log("MQTT server is NOT present");
});