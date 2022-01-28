var count = 10;

jsync function callX() {
    count++;
    console.log("---------------- CallX ... ", count);
    return count;
}

setInterval(()=> {

    if (jsys.type == "fog")
	console.log("Return value ", callX());
    
}, 500);
