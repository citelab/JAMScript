

jdata {
    int qq as uflow;
    int ppp as uflow;
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
        console.log("Writing to uflow -- qq ", count);
        qq.write(count++);
    }
}

async function runloop2() {
    while(true) {
        await sleep(1000);
        console.log("Writing to uflow -- pp ", count);
        ppp.write(count++);
    }
}

async function toploop() {
    runloop();
    runloop2();    
}

async function getloop() {
    let x;
    while(true) {
        x = await ppp.readLast();
        console.log("Value received... ", x);
    }
}

if (jsys.machtype == "fog") {
    console.log("I am in the fog....");
    await getloop();
} else {
    console.log("I an in the device...");
    await toploop();
}

