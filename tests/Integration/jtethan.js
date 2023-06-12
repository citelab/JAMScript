
jcond {
    typeAonly: jsys.tag == "typeA";
    fogonly: jsys.type == "fog";
}

let count = 10;

jtask function remoteEchoReceiver(str, count) {
    console.log("Received an echo!");
    console.log(str, count);
}

let long = jsys.long;
let lat = jsys.lat;

setInterval(()=> {
    remoteEcho("Device to worker communication");

    console.log("Calling compyou.. ");

}, 3000);


