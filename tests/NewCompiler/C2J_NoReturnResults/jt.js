let count = 0;

jasync you(str: char*, num: int[]) {
    count++;
    console.log("Message received: ", str, num, " local count ", count);
}

setInterval(()=> {
    console.log("                                              hello.. main loop ");
}, 2000);
