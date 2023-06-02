
jcond {
    fogonly: jsys.type == "fog";
    typeAonly: jsys.tag == "typeA";
}

jdata {
    struct location {
	float x;
	float y;
    } loc as uflow;
    int qq as uflow;
    int ppp as uflow;
    float xx as dflow;
}

let count = 10;

jtask {fogonly} function compyou(str) {
    count++;
    console.log("Compyou running.... ",  count, str);
    let qq = count * count;
    //let waitTill = new Date(new Date().getTime() + 50);
    //while(waitTill > new Date()){}
    console.log("Value I am returning..... to the other side == ", qq);
    return qq;
}

let long = jsys.long;
let lat = jsys.lat;

async function sleep(x) {
    return new Promise((resolve, reject) => {
        setTimeout(()=> {
            resolve(true);
        }, x);
    });
}

async function runloop() {
    while(true) {
        await sleep(1000);
        console.log("Writing to uflow -- qq ", count);
        qq.write(count++);
    }
}

async function runloop2() {
    while(true) {
        await sleep(1000);
        console.log("Writing to uflow -- pp ", count);
        ppp.write(count++);
    }
}

async function toploop() {
    runloop();
    runloop2();    
}

async function getloop() {
    let x;

    jsys.setLoc({long: 10, lat: 20});
    while(true) {
        x = await ppp.readLast();
        console.log("Value received... ", x);
    }
}


    await getloop();


