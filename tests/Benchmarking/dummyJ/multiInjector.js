var mqtt = require('mqtt');
var cbor = require('cbor-x');
var JAMP = require('./jamprotocol');
var udp = require('dgram');
var constants = require('./constants');

let count = 0;
let taskid = 1;

const multicast_addr = constants.multicast.Prefix + "." +  1;
const sport = constants.multicast.sPort; //16500

const sender = udp.createSocket({type:"udp4", reuseAddr:true});


function testInject() {
    count++;
    let data = JAMP.createMachTaskReq("remoteCall", ["xxxx"], "nodeid", taskid++, 1);
    data = cbor.encode(data);
    sender.send(data, 0, data.length, sport, multicast_addr);
}

function multiInject() {
    testInject();
    testInject();
    testInject();
    testInject();
    testInject();
    testInject();
    testInject();
    testInject();
    testInject();
    testInject();
}

function doLoading() {
    setInterval(()=> {
	multiInject();
    }, 1000);
}

function doLoadingX() {
    setImmediate(doLoadingX);
    testInject();
}


//doLoading();
doLoadingX();

setInterval(()=> {
    console.log("Count: ", count);
    count = 0;
}, 1000);
