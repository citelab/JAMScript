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
            let x = await ghandle.next();
	        let y = await ghandle.next();
            ghandle.return();
            console.log("Return value from the call.. ", x.value, y.value);
	    } catch(e) {
            console.log("Error.. ", e.message);
	    }
    }
}
