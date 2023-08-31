jcond {
    cloudonly: jsys.type == "cloud";
    fogonly: jsys.type == "fog";
	devonly: jsys.type == "device";
}

let counter = 1;
let gidtbl = new Map();

jtask {cloudonly} function getCloudId(uid) {
    let id = gidtbl.get(uid);
    if (id === undefined) {
	id = counter++;
	gidtbl.set(uid, id);
    }
    console.log("Id... ", id);
    return id;
}

jtask {fogonly} function getId(uid) {

    while (1) {
	let gchandle = getCloudId(uid);
	try {
	    let x = await gchandle.next();
	    await gchandle.return();
	    return x;
	} catch (e) {
	    gchandle.return();
	}
    }
}

jtask* {devonly} function driveNode(long, lat, soc) {
	jsys.setLoc({long: long, lat: lat});
	console.log(long, lat);
}

async function idle() {
}

if (jsys.type === "device") {
    let myindx = await getId(jsys.id);
    console.log("=============== >> My index... ", myindx);
} else {
    console.
    await idle();
}

