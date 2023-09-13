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
    return id;
}

jtask {fogonly} function getId(uid) {

    while (1) {
        let gchandle = getCloudId(uid);
        try {
            let x = await gchandle.next();
            await gchandle.return();
            return x.value;
        } catch (e) {
            gchandle.return();
        }
    }
}

if (jsys.type === "device") {
    let gihandle = getId(jsys.id);
    try {
    	let myindx = await gihandle.next();
	    console.log("=============== >> My index... ", myindx.value);
    } catch (e) {
	    console.log("Error calling getId.. ", e.message);
    }
}
