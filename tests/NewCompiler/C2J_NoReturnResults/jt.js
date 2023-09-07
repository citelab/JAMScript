let count = 0;

jasync you(str: char*) {
    count++;
    console.log("Message received: ", str, " local count ", count);
}

setInterval(()=> {
    console.log("                                              hello.. main loop ");
}, 2000);
