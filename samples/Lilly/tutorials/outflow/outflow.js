jdata{
	int sensorStatus as logger;
	f as flow with flowFunc of sensorStatus;
	outF as outflow of f; 
}

outF.start();

function flowFunc(inputFlow){
	return inputFlow;
}