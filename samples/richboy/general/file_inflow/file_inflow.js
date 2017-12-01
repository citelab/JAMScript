jdata{
    dataIn as inflow of app://fileOutflow.shellFileOutflow;
}

dataIn.setTerminalFunction(console.log);