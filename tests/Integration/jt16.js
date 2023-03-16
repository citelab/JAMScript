
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

let count = 10;

async function runloop() {
    while(true) {
        await sleep(1000);
        console.log("Logging...", count);
        qq.write(count++);

    }
}

await runloop();
