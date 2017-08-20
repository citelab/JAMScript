jcond {
    fogonly: sys.type == "fog";
    cloudonly: sys.type == "cloud";
    devonly: sys.tag == "temp_sensor";
}

jasync {fogonly} function pong() {
    console.log("pong......");
}


jasync {cloudonly} function pong2() {
    console.log("pong......");
}


jasync {devonly} function pong3() {
    console.log("pong......");
}

setInterval(()=> {
   console.log("Calling pong...");
    pong();

}, 2000);


