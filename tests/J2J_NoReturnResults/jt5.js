// @ToasterConfig
// Fogs: 1
// Devices: 1

let count = 10;

jasync xyz(hello: char*) {
    console.log("Message from controller ...", hello);
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
	    xyz("hi").catch((e) => console.log(e, " at ", jsys.type));
	    await sleep(1000);
	}
} else {
    while (1) {
	jsys.setLoc({lat: count, long: 2 * count});
	count = count + 5;
	await sleep(1000);
    }
}
