let count = 10;

async function sleep(n) {
    return new Promise((resolve)=> {
        setTimeout(()=> {
            resolve();
        }, n);
    });
}

while (1) {
    await sleep(1000);
    if (jsys.type === 'fog') {
	 let ghandle = get_a_value(count++);
	try {
            let a = await ghandle.next();
	    let b = await ghandle.next();
	    let c = await ghandle.next();
	    let d = await ghandle.next();
	    let e = await ghandle.next();
            ghandle.return();
            console.log("Return value from the call.. ", a, b, c, d, e);
	} catch(e) {
            console.log("Error.. ", e.message);
	}
    }
}
