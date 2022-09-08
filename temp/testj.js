
async function job(cnt, i) {
    console.log("Processing... ", cnt);
    switch (i) {
    case 0:
	await dojob();
	console.log("--------------------------");
	break;
    case 1:
	console.log("I am in 1 ");
	break;
    case 2:
	console.log("I am in 2 ");
	break;
    }
    console.log("Done with ", cnt);
}

function dojob() {
    return new Promise((resolve, reject)=> {
        setTimeout(()=> {
            resolve(true);
        }, 500);
    });
}


let count = 0;
setInterval(()=> {
    console.log("Launching job....#", count++);
    job(count, count % 3);
}, 100);
