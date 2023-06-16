

jasync function runQ() {
    console.log("runQ called.");
}


jasync function runX() {
    console.log("runX called.");
}

jasync function runY() {
    console.log("runY called.");
}


jasync function runZ() {
    console.log("runZ called.");
    
}


setInterval(()=> {

    if (jsys.type === "cloud")
	runQ();
    if (jsys.type === "fog")
	runX();
    if (jsys.type === "device" && jsys.tags == "nodeA")
	runY();
    if (jsys.type === "device" && jsys.tags == "nodeB")
	runZ();

}, 600);
