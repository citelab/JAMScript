jdata{
	int cout as logger;
	f as flow with flowFunc of cout;
	outF as outflow of f; 
}

outF.start();

function flowFunc(inputFlow){
	return inputFlow;
}