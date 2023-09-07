jdata {
    struct _zz {
	    int x;
	    double yy;
	    int qq[3];
	    double ddd;
    } xx as uflow;
}

async function getloop() {
    let x;
    while(true) {
        x = await xx.readLast();
        console.log("Value received... ", x);
    }
}


await getloop();
