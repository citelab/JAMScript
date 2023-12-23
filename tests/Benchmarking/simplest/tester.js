let count = 0;

function incrCount() {
    count++;
    setImmediate(incrCount);
}

incrCount();

setInterval(()=> {
    console.log("Count: ", count);
    count = 0;
}, 1000);
