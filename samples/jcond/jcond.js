jconditional fogonly {
    fog {
        version > 1.0;
    }
}

jasync {fogonly} function pong() {
    console.log("pong..");
    ping();
}
