var nano = require('nanomsg');
var cbor = require('cbor');

var rep = nano.socket('rep');
var addr = 'tcp://*:5555';
rep.bind(addr);

function sendObject(sock, obj) {
    var encoded = cbor.encode(obj);
    sock.send(encoded);
}

rep.on('data', function(buf) {
    cbor.decodeFirst(buf, function(error, obj) {
        console.log(obj);
        obj["cmd"] = "PONG";
        obj["opt"] = "CCORE";
        console.log("Actid type ", typeof(obj["actid"]), obj["actid"]);
        sendObject(rep, obj);
    });
});
