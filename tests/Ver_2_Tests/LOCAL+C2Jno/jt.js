let count = 0;

jtask* function you(str) {
    count++;
    console.log("Message received: ", str, " local count ", count);
}

setInterval(()=> {
    console.log("hello.. main loop ");
}, 1000);
