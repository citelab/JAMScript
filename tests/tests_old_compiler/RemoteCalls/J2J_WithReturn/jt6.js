let count = 10;

// @ToasterConfig
// Fogs: 1
// Devices: 1

jtask function abc(hello) {
    console.log("Message from controller ...", hello);
    count++;
    return count * count;
}

async function sleep(n) {
    return new Promise((resolve)=> {
        setTimeout(()=> {
            resolve();
        }, n);
    });
}

if (jsys.type == 'fog') {
    while (1) {
	await sleep(1000);
	let ahandle = abc("hi");
	try {
	    let x = await ahandle.next();
	    let y = await ahandle.next();
	    let z = await ahandle.next();
	    let v = await ahandle.next();
	    await ahandle.return();
	    console.log("Return... ", x.value, y.value, z.value, v.value);
	} catch (e) {
	    await ahandle.return();
	    console.log("Error... ");
	}
    }
} else	    
    console.log("Nothing to call...");
