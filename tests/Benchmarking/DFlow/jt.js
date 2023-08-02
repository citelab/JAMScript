
jdata {
    int xx as dflow;
}

let tick = 10;
let count = 0;

async function sleep(x) {
    return new Promise((resolve, reject) => {
        setTimeout(()=> {
            resolve(true);
        }, x);
    });
}


async function doCall() {
  await sleep(1);
  xx.write(tick++);
  count++;
  setImmediate(doCall);
}

setImmediate(doCall);

setInterval(()=>{
  console.log("Sent: "+count)
  count = 0;
}, 1000);

