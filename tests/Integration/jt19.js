
jdata {
    int xx as dflow;
}

let count = 10;

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
        console.log("Writing to dflow -- xx ", count);
        xx.write(count++);
    }
}


async function toploop() {
    runloop();
}

await toploop();

