var count = 10;

jsync function callX() {
    count++;
    console.log("CallX ... ", count);
    return count;
}

setInterval(()=> {

    if (jsys.type == "device")
	console.log("Return value ", callX());
    
}, 500);
