
jdata {
    double yy as dflow;
}

let count = 10.75;

async function sleep(x) {
    return new Promise((resolve, reject) => {
        setTimeout(()=> {
            resolve(true);
        }, x);
    });
}

async function runloop() {
    while(true) {
        await sleep(1000);
        console.log("Writing to dflow -- yy ", count);
        yy.write(count + 1/count);
	count = count * 1.005;
    }
}


async function toploop() {
    runloop();
}

await toploop();

