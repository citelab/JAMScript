jcond {
    cloudOnly: jsys.type == "cloud";
    fogOnly: jsys.type == "fog";
    deviceOnly: jsys.type == "device";
}

jasync {cloudOnly} function f1() {
    console.log("Hello from the cloud!")
}

jasync {fogOnly} function f2() {
    console.log("Hello from the fog!");
    f1();
}

jasync {deviceOnly} function f3() {
    console.log("Hello from the device!");
    f2();
}

if (jsys.type == "device") {
    setInterval(f3, 500);
}
