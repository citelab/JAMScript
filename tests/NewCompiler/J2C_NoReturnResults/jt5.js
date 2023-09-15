let count = 10;

async function sleep(n) {
    return new Promise((resolve)=> {
        setTimeout(()=> {
            resolve();
        }, n);
    });
}


if (jsys.type === 'fog') {
    while(1) {
	await sleep(1000);
	console.log("Hello... calling the C side... ");
	testfunc(count++).catch((e) => {
            console.log("Error in calling testfunc ", e);
	});
    }
} else {
    console.log("At the device...");
}
