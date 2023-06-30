let count = 0;

function you(str) {
    count++;
    console.log("String.. ", str, " count ", count);
}

setInterval(()=> {
    console.log("                             hello.. main loop ");
    you("hello..");
}, 1);
