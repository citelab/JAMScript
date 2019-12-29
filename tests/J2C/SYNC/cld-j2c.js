
setInterval(()=> {
    if (jsys.type === "cloud") {
	var x = dotask();
	console.log(x);
    }
}, 1000);
