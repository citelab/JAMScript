let count = 10;

setInterval(()=> {
    console.log("hello.. main loop.. calling the C function testfunc..  ");
    testfunc(count++).catch(()=> {
	console.log("Error in calling testfunc...");
    });
}, 10);
