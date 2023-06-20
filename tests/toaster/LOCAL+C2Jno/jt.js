let count = 0;



jtask* function you(str) {
    assert(12==12);
    count++;
    console.log("Message received: ", str, " local count ", count);
    coverage();
}

setInterval(()=> {
    coverage();
    console.log("hello.. main loop ");
}, 1000);
