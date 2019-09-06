

jasync function runthisfunc() {
    console.log("RunthisFunc called...");
}


setInterval(()=> {

    if (jsys.type === "fog")
	runthisfunc();
}, 600);
