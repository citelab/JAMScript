var nano = require('nanomsg');

var test = function(buf) {
    console.log("Function called..");
    console.log(buf);
};

var sock = nano.socket('rep');
sock.bind('tcp://127.0.0.1:5555');

sock.on('data', test);

var pock = nano.socket('rep');
pock.bind('tcp://127.0.0.1:5565');

pock.on('data', test);

console.log("hello");

setTimeout(function() {
    console.log("1 sec has passed.");
    sock.close();
    setTimeout(function () {
        try {
        var sock = nano.socket('rep');
        sock.bind('tcp://127.0.0.1:5555');
        sock.on('data', test);
        console.log("ffdf");
    } catch (err) {
        console.log("Error" + err);
    }
    }, 4000);
}, 1000);
