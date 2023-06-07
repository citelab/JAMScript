
jdata {
    struct {
	int x;
	double yy;
    } zz as uflow;
}

let count = 10;

async function sleep(x) {
    return new Promise((resolve, reject) => {
        setTimeout(()=> {
            resolve(true);
        }, x);
    });
}


async function getloop() {
    let x;
    while(true) {
        x = await xx.readLast();
        console.log("Value received... ", x);
    }
}


await getloop();

