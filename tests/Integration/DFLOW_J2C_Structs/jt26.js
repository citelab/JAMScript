
jdata {
    struct __zz {
	int x;
	char* u;
	double yy;
    } qq as dflow;
}

async function sleep(x) {
    return new Promise((resolve, reject) => {
        setTimeout(()=> {
            resolve(true);
        }, x);
    });
}

let count = 0;

async function runloop() {
    while(true) {
        await sleep(1000);
        console.log("Writing to dflow -- ", values[count]);
        qq.write({x: 12, yy: 5.67});
    }
}


await runloop();



