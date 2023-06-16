
jdata {
    struct __xx {
	int yy;
	double zz;
    } zzz as uflow;
    int qq as uflow;
    int ppp as uflow;
    char* qqqq as uflow;
    float xxxx as uflow;
    double yyy as uflow;
}

async function getloop() {
    let x;
    while(true) {
        x = await ppp.readLast();
        console.log("Value received... ", x);
    }
}

console.log("I am in the device J .. expecting data from the C workers.");
await getloop();
