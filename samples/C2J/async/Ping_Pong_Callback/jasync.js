
jasync function ping(msg, cb) {
    console.log("Ping received with message", msg);
    cb("message from J");
}
