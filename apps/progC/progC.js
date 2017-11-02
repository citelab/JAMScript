jdata{
	shellIn as inflow of app://jamshell.shellOut;
}

shellIn.setTerminalFunction(function(entry) {
	console.log("progC:");
	console.log(entry.data);
});