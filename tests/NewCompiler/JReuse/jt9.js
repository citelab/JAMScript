let count = 10;
let countcount = 0;

async function sleep(n) {
    return new Promise((resolve)=> {
        setTimeout(()=> {
            resolve();
        }, n);
    });
}

if (jsys.type === 'fog' || true) {
    while (1) {
	    await sleep(1000);
	    try {
	        for await (const x of get_a_value(count)) {
		        console.log("Return value from Get_a_value = ", x);
	        }
	    } catch (e) {
	        console.log("Error message... ", e.message);
	    }
        if (countcount > 0)
            count++;
        countcount = (countcount + 1) % 3
    }
}
