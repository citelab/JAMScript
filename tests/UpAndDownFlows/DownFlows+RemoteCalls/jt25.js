jdata {
    char* qq as dflow;
}

async function sleep(x) {
    return new Promise((resolve, reject) => {
        setTimeout(()=> {
            resolve(true);
        }, x);
    });
}

let count = 0;
let values = ['honda', 'nissan', 'tesla', 'mini', 'morris', 'vauxhall'];

async function runloop() {
    while(true) {
        await sleep(1000);
        console.log("Writing to dflow -- ", values[count]);
        qq.write(values[count]);
	    count = (count + 1) % 6;
    }
}

await runloop();
