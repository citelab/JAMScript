
jdata {
    int qq as uflow;
}

let x;
let count = 0;

async function sleep(x) {
    return new Promise((resolve, reject) => {
        setTimeout(()=> {
            resolve(true);
        }, x);
    });
}


async function periodicUpdate() {
    while(true) {
	await sleep(1000);
	console.log("Count: ", count);
	count = 0;
    }
}

async function readRedis() {
    while(true) {
	x = await qq.readLast();
	count++;
    }
}

async function periodicPing() {
    while(true) {
	await sleep(1000);
	console.log("Ping.. ");
    }
}

async function toploop() {
    periodicUpdate();
    readRedis();
    periodicPing();
}

toploop();
