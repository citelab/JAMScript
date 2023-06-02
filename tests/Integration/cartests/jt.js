if(jsys.type == "fog") {
	setInterval(()=> {
		console.log("pinging cars");
		carping(10).catch((e)=> {
			console.log("Error in calling carping: " + e);
		});
	}, 1000);
}
