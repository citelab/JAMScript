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
    try { 
	for await (const x of get_a_value(count++)) {
	    console.log("Return value from Get_a_value = ", x);
	}
    } catch (e) {
	console.log("Error message... ", e.message);
    }
}
