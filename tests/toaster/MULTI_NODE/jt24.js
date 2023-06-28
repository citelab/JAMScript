// @ToasterConfig
// Fogs: 1
// Devices: 1


jcond {
    typeAonly: jsys.tag == "typeA";
    fogonly: jsys.type == "fog";
}

let count = 10;


let weDidThisCoverageMarker = false;


jtask function remoteEchoReceiver(str, count) {
    console.log("Received an echo!");
    console.log(str, count);
    coverage();
    weDidThisCoverageMarker = true;
}

jtask {fogonly} function compyou(str) {
    count++;
    console.log("Compyou running.... ",  count, str);
    let qq = count * count;
    console.log("Value I am returning..... to the other side == ", qq);

    remoteEcho("Fog to worker communication");

    coverage();
    assert(weDidThisCoverageMarker);
    
    return qq;
}

let long = jsys.long;
let lat = jsys.lat;

setInterval(()=> {
    console.log("Tag..... ", jsys.tags, "device type ", jsys.type);
    if (jsys.type === 'device') {
        coverage();
        long = (long + 5) % 170;
        jsys.setLoc({long: long, lat: lat});
        console.log("Longitude and Latitude .... ", jsys.long, jsys.lat);
    }
    remoteEcho("Device to worker communication");
    coverage();
    console.log("Calling compyou.. ");
    let x = compyou(" String = " + count++); // --> let x = jworklib.machExecuteRV("compyou", ...)
    x.then((y)=> {console.log(y.status(), y.values())}).catch(()=> {console.log("Helllo.....");});

}, 3000);


