jcond {
    fogonly: sys.type == 10;
}

jasync {fogonly} function pong() {
    console.log("pong..");
    ping();
}
