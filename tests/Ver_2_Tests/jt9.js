let count = 10;

jcond {
    fogonly: jsys.type == "fog";
    typeAonly: jsys.tag == "typeA";
}

let long = jsys.long;
let lat = jsys.lat;

setInterval(()=> {
    if (jsys.type === 'device') {
        long = (long + 5) % 170;
        jsys.setLoc({long: long, lat: lat});
        console.log("Tag..... ", jsys.tags);
        console.log("Longitude and Latitude .... ", jsys.long, jsys.lat);
    }

    answerme("String -- " + count).catch((e)=> { console.log("Received... ", e)});
    count++;
}, 2000);


