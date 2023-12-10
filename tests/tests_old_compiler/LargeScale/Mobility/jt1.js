// @ToasterConfig
// Fogs: 20
// Devices: 40
// Workers: 1
// RunToTimeout: True

jcond {
    typeAonly: jsys.tag == "typeA";
    fogonly: jsys.type == "fog";
}

let count = 10;

jtask* function remoteEchoReceiver(str, count) {
    console.log("Received an echo!");
    console.log(str, count);
    coverage();
}

jtask {fogonly} function compyou(str) {
  count++;
  console.log("Compyou running.... ",  count, str);
  let qq = count * count;
  console.log("Value I am returning..... to the other side == ", qq);
  
  remoteEcho("Fog to worker communication").catch((e)=> {
      console.log("Calling remoteEcho from " + jsys.type + " got an oopsie ");
  });

  coverage();
  
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

  remoteEcho("Device to worker communication").catch((e)=> {
    console.log("Calling remoteEcho from " + jsys.type +  " got an oopsie ");
  });
  
  coverage();
  console.log("Calling compyou.. ");
    compyou(" String = " + count++).then((y)=> {console.log(y.values())}).catch(()=> {console.log("Helllo.....");});
  
}, 3000);


