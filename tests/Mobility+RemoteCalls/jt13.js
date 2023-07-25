let count = 10;


let long = jsys.long;
let lat = jsys.lat;

setInterval(()=> {
    console.log("Tag..... ", jsys.tags);
    if (jsys.type === 'device') {
        long = (long + 5) % 170;
        jsys.setLoc({long: long, lat: lat});
        console.log("Longitude and Latitude .... ", jsys.long, jsys.lat);
    }

    answerme(jsys.type, "WHat is the count? - " + count).catch((e)=> { console.log("Received... ", e)});
    count++;
}, 200);


