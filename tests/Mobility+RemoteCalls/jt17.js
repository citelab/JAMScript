
jcond {
    fogonly: jsys.type == "fog";
}

let count = 10;

jtask {fogonly} function compyou(str) {
    count++;
    console.log("Compyou running.... ",  count, str);
    let qq = count * count;
    resolve(qq);
}

let long = jsys.long;
let lat = jsys.lat;
let direction = 0;

if (jsys.type === 'device') {
    setInterval(()=> {
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
	compyou("hello").then((x)=> {
	    console.log("Value = ", x.values());
	}).catch(()=> {});
    }, 2500);
}
