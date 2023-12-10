// @ToasterConfig
// Fogs: 2 
// Devices: 1
// Workers: 1
// RunToTimeout: True

jcond {
    typeAonly: jsys.tag == "typeA";
    fogonly: jsys.type == "fog";
}

let count = 10;

jtask* function updateLocation(vehicleId, latitude, longitude) {
    console.log("Received an echo! from ", vehicleId);
    console.log(latitude, longitude);
    
    jsys.setLoc({long: longitude, lat: latitude});
    coverage();
}

setInterval(()=> {
  console.log("                                              hello.. main loop ");
}, 2000);


