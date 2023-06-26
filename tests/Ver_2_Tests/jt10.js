let count = 10;

jcond {
    fogonly: jsys.type == "fog";
    typeAonly: jsys.tag == "typeA";
}

let long = jsys.long;
let lat = jsys.lat;

jtask* function answerme_ctl(t, s, x, y) {
    console.log("Answer me called: ", s, " -- by -- ", t, x, y);
}

setInterval(()=> {
    console.log("Tag..... ", jsys.tags);
    if (jsys.type === 'device') {
        long = (long + 5) % 170;
        jsys.setLoc({long: long, lat: lat});
        console.log("Longitude and Latitude .... ", jsys.long, jsys.lat);
    }

    answerme_ctl(jsys.tags, "String -- " + count, 100, 1050).then(()=>{console.log("good")}).catch((e)=> { console.log("Received... ", e)});
    count++;
}, 20);


