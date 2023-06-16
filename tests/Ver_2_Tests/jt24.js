
jcond {
    typeAonly: jsys.tag == "typeA";
    fogonly: jsys.type == "fog";
}

let count = 10;

jtask function remoteEchoReceiver(str, count) {
    console.log("Received an echo!");
    console.log(str, count);
}

jtask {fogonly} function compyou(str) {
    count++;
    console.log("Compyou running.... ",  count, str);
    let qq = count * count;
    console.log("Value I am returning..... to the other side == ", qq);

    remoteEcho("Fog to worker communication");

    return qq;
}

let long = jsys.long;
let lat = jsys.lat;

setInterval(()=> {
    console.log("Tag..... ", jsys.tags, "device type ", jsys.type);
    if (jsys.type === 'device') {
        long = (long + 5) % 170;
        jsys.setLoc({long: long, lat: lat});
        console.log("Longitude and Latitude .... ", jsys.long, jsys.lat);
    }
    remoteEcho("Device to worker communication");

    console.log("Calling compyou.. ");
    let x = compyou(" String = " + count++); // --> let x = jworklib.machExecuteRV("compyou", ...)
    x.then((y)=> {console.log(y.status(), y.values())}).catch(()=> {console.log("Helllo.....");});

}, 3000);


