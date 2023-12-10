let count = 10;

let long = jsys.long;
let lat = jsys.lat;

async function sleep(n) {
    return new Promise((resolve)=> {
        setTimeout(()=> {
            resolve();
        }, n);
    });
}


jtask* function answerme_ctl(t, s) {
    console.log("Answer me called: ", s, " -- by -- ", t);
    await sleep(1000);
    answerme("hello.. from the controller..").catch((e)=> { console.log("Error.. "); });
}

setInterval(()=> {
    if (jsys.type === 'fog') {
        long = (long + 5) % 170;
        jsys.setLoc({long: long, lat: lat});
        console.log("Longitude and Latitude .... ", jsys.long, jsys.lat);
    }

    answerme_ctl(long, "String -- " + count).catch((e)=> { console.log("Received... ", e)});
    count++;
}, 1000);


