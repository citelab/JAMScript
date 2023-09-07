jdata {
    int qq as uflow;
    int ppp as uflow;
    char qqqq[40] as uflow;
    float xxxx as uflow;
    double yyy as uflow;
}

async function getloop() {
    let x, y;
    while(true) {
        x = await ppp.readLast();
        y = await qqqq.readLast();
        console.log("Value received... ", x, y);
    }
}

console.log("I am in the device J .. expecting data from the C workers.");
await getloop();
