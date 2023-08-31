
jcond {
    fogonly: jsys.type == "fog";
}

let count = 10;

jtask {fogonly} function compyou(str) {
    count++;
    console.log("Compyou running.... ",  count, str);
    let qq = count * count;
    return qq;
}

let long = jsys.long;
let lat = jsys.lat;
let direction = 0;

async function sleep(n) {
    return new Promise((resolve)=> {
        setTimeout(()=> {
            resolve();
        }, n);
    });
}

async function run() {

    if (jsys.type === 'device') {
	while (1) {
	    await sleep(500);
	    if (direction === 0) {
		if (long < 300)
		    long += 10;
		else
		    direction = 1 - direction;
	    } else {
		if (long > 10)
		    long -= 10;
		else
		    direction = 1 - direction;
	    }
	    jsys.setLoc({long: long, lat: lat});
	    let cyhandle = compyou("hello, howdy");
	    try {
		let x = await cyhandle.next();
		console.log("Result.. ", x);
	    } catch(e) {
		console.log("Error ", e.message);
	    }
	}
    }
}

run();


