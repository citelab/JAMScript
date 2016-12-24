var mosca = require('mosca');

var pubSubSettings = {
    type: 'redis',
    redis: require('redis'),
    db: 12,
    port: 6379,
    return_buffers: true, // to handle binary payloads
    host: "localhost"
};

var settings = {
    port: 1883,
    backend: pubSubSettings
};


module.exports = function(debug) {
    var server = new mosca.Server(settings);

    server.on('clientConnected', function(client) {
        if (debug !== undefined)
            console.log('Client connected: ', client.id);
    });

    // fired when a message is received
    server.on('published', function(packet, client) {
        if (debug !== undefined)
            console.log('Message published: ', packet.payload);
    });

    server.on('ready', setup);

    // fired when the mqtt server is ready
    function setup() {
        console.log('MQTT is running.');
    }
}


