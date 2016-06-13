
setInterval(function () { console.log("hello") }, 1);

function qq() {
     setImmediate(() => {
 	    console.log("world..");
	    qq();
	 });
}

qq();
