jdata{
	struct currentTime{
		int year;
		int month;
		int date;
		int hour;
		int minute;
		int second;
	} myClock as logger;

	f as flow with flowFunc of myClock;

	outF as outflow of f;
}

/* FLOW ACTIONS */
(function poll(){
	if(myClock.size()<1){
		console.log("Waiting for a C-Node");
		setTimeout(poll, 1000);
	}
	f.startPush();
})();

function flowFunc(inputFlow){
	return inputFlow;
}

f.setTerminalFunction(function(entry){
	var data = entry.data;
	console.log("Sending data......")
	prettyPrint(data);
});

function prettyPrint(time){
	var output = String(time.year+"-"+time.month+"-"+time.date+" "+time.hour+":"+time.minute+":"+time.second);
	console.log(output);
	return output;
}