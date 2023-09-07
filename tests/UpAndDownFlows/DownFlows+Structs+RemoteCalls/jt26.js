jdata {
    struct __zz {
	    int x;
	    char u[30];
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

let names = ["jon", "benson", "muddin3", "ethan", "george"];

async function runloop() {
    while(true) {
        await sleep(1000);
        let values = {x: count, yy: 5.67 + count / 47, u: "hello " + names[count % names.length]};
        console.log("Writing to dflow -- ", values);
        qq.write(values);
        count += 1;
    }
}


await runloop();
