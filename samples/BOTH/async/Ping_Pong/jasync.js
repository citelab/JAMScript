var counter = 0;

jasync function pong() {
    counter = counter + 1;
    console.log("pong..", counter);
    ping();
}
