jcond {
    fogonly: sys.sync >= 10;
}

jasync {fogonly} function pong() {
    console.log("pong..");
    ping();
}
