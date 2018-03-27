

const appName = "App" + process.argv[2];
console.log("App Name is: ", appName);

const {Flow, RealtimeFlow} = require('../flow.js')({app: appName});


var flow = Flow.fromRange(1, 10);
var array = ["richboy", "david", "richard", "lekan", "xiru", "ben", "mahesh", "michael", "andrew", "lilly"];
var count = 0;
var index = Math.floor(Math.random() * array.length);

var rt = new RealtimeFlow(appName == "App1" ? "App2" : "App1", "simple", null, callFunc);

function callFunc(data){
    console.log("received: ", data);
}

setInterval(function(){
    count++;
    console.log("sending: ", array[index] + " - " + count);
    rt.send(array[index] + " - " + count);
}, Math.ceil(Math.random() * 3) * 1500);