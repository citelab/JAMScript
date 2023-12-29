
let count = 10;

async function sleep(n) {
    return new Promise((resolve)=> {
        setTimeout(()=> {
            resolve();
        }, n);
    });
}

while(1) {
    await sleep(1000);
    console.log("Hello... calling the C side... ");
    try {
        await testfunc(count++);
    } catch(e) {
        console.log("Error.. ", e.message);
    }
}
