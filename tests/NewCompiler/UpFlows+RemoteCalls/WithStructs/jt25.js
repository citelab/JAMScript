jdata {
    struct _zz {
	    int x;
	    double yy;
        char str[30];
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
