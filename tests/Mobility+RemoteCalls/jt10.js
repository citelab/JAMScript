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

jtask* function answerme_ctl(t, s, x, y) {
    console.log("Answer me called: ", s, " -- by -- ", t, x, y);
    await sleep(2000);
    console.log("Another print after the delay...");
}

let speed = Math.random() * 5 + 3;

setInterval(()=> {
    if (jsys.type === 'device') {
        long = (long + speed) % 170;
        jsys.setLoc({long: long, lat: lat});
        console.log("Longitude and Latitude .... ", jsys.long, jsys.lat);
    }

    answerme_ctl(jsys.tags, "String -- " + count, 100, 1050).catch((e)=> { console.log("Received... ", e)});
    count++;
}, 5000);


