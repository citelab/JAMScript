var mqtt = require('mqtt');
var cbor = require('cbor-x');
var JAMP = require('./jamprotocol');

let count = 0;

function netSetup() {
    let sock = mqtt.connect("tcp://localhost:1883", {});
    sock.on('connect', ()=> {
        sock.subscribe('/yyy/requests/up');
    });
    return sock;
}


let sock = netSetup();
sock.on('message', (m, q)=> {
    let qmesg = cbor.decode(q);
    count++;
});

setInterval(()=> {
    console.log("Count: ", count);
    count = 0;
}, 1000);
