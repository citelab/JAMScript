var counter = 0;

jasync function pong() {
    counter = counter + 1;
    ping();
    console.log("ponging......", counter);
}
