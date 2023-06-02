if(jsys.type == "fog") {
	setInterval(()=> {
		console.log("pinging cars");
		carping(10).catch(()=> {
			console.log("Error in calling carping...");
		});
	}, 4000);
}
