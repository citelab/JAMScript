var mqtt = require('mqtt');
var cbor = require('cbor-x');
var JAMP = require('./jamprotocol');

let count = 0;
let taskid = 1;

function testInject(sock) {
    count++;
    let msg = JAMP.createMachTaskReq("remoteCall", ["xxxx"], "nodeid", taskid++, 1);
    smsg = cbor.encode(msg);
    sock.publish('/yyy/requests/up', smsg);
}

function multiInject(sock) {
    testInject(sock);
    testInject(sock);
    testInject(sock);
    testInject(sock);
    testInject(sock);
    testInject(sock);
    testInject(sock);
    testInject(sock);
    testInject(sock);
    testInject(sock);
}

function doLoading(sock) {
    setInterval(()=> {
	multiInject(sock);
    }, 1000);
}

function doLoadingX(sock) {
    setImmediate(doLoadingX, sock);
    testInject(sock);
}

function netSetup() {
    let sock = mqtt.connect("tcp://localhost:1883", {});
    sock.on('connect', ()=> {
        sock.subscribe('/test-channel');
    });
    return sock;
}



let sock = netSetup();
//doLoading(sock);
doLoadingX(sock);

setInterval(()=> {
    console.log("Count: ", count);
    count = 0;
}, 1000);
