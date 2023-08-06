
let count = 10;

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
	console.log("Hi...");
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
    periodicPing();
}

toploop();
