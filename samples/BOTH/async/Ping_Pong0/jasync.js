var counter = 0;

jasync function pong(q) {
    counter = counter + 1;
    console.log("pong..", counter, q);
    ping();
}
