jdata{
	struct currentTime{
		int year;
		int month;
		int date;
		int hour;
		int minute;
		int second;
	} myClock as broadcaster;

	inF as inflow of app://time.outF;
}

/* FLOW ACTIONS */

inF.setTerminalFunction(function(entry){
	var data = entry.data;
	console.log("Received data ......");
	prettyPrint(data);

	myClock.broadcast(data);
});

function prettyPrint(time){
	var output = String(time.year+"-"+time.month+"-"+time.date+" "+time.hour+":"+time.minute+":"+time.second);
	console.log(output);
	return output;
}