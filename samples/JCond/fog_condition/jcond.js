jcond {
    fogonly: sys.type == "fog";
    cloudonly: sys.type == "cloud";
    devonly: sys.tag == "temp_sensor";
}

jasync {fogonly} function pong() {
    console.log("================ Pong!");
}


jasync {cloudonly} function pong2() {
    console.log("In pong2..");
    pong();
}


jasync {devonly} function pong3() {
    console.log("pong......");
}

setInterval(()=> {
   console.log("Calling pong...");
   pong2();

}, 2000);


