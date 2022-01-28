jcond {
    deviceOnly: jsys.type == "device";
}

jasync {deviceOnly} function j2j_async(id) {
    console.log("J2J async called from fog", id);
}

function f() {
    j2j_async(jsys.id);
    j2c_async(jsys.id);
    setTimeout(f, 3000);
}

if (jsys.type === "fog") {
    setTimeout(f, 3000);
}
