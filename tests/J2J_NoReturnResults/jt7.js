let count = 10;

// @ToasterConfig
// Fogs: 1
// Devices: 1

jsync int xyz(hello: char*) {
    console.log("Message from controller ...", hello);
    return hello.length;
}

async function sleep(n) {
    return new Promise((resolve)=> {
        setTimeout(()=> {
            resolve();
        }, n);
    });
}

if (jsys.type === 'fog') {
    while (1) {
	await sleep(1000);
	for await (const x of xyz("hello, world"))
	    console.log("Value ", x);
    }
}
