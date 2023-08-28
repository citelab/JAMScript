var mqtt = require('mqtt');
var cbor = require('cbor-x');
var JAMP = require('./jamprotocol');
var udp = require('dgram');
var constants = require('./constants');

let count = 0;

const multicast_addr = constants.multicast.Prefix + "." +  1;
const sport = constants.multicast.sPort; 

const listener = udp.createSocket({type:"udp4", reuseAddr:true});

// receiving on 16000
listener.bind(sport, multicast_addr, function() {
    listener.addMembership(multicast_addr);
    listener.setBroadcast(true);
});

listener.on("message", function (msg, err) {
    let qmsg = cbor.decode(msg);
    count++;
});


setInterval(()=> {
    console.log("Count: ", count);
    count = 0;
}, 1000);
