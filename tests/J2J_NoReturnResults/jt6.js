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
	let ahandle = xyz("hello, world");
	try {
	    let x = await ahandle.next();
	    ahandle.return();
	    console.log("Value ", x.value);
	} catch (e) {
	    console.log("Error .. ", e.message);
	    ahandle.return();
	}
    }
}
