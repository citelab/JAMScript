jcond {
    fogonly: sys.type == "fog";
    testdata: avg__x >= 2.0;
}

jasync {fogonly} function pong() {
    console.log("pong..");
    ping();
}

jasync {testdata} function pong2() {
    console.log("pong..");
    ping();
}
