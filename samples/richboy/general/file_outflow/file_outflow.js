jdata{}
var fileInputFlow = Flow.fromFile("../answers.csv");
var shellFileOutflow = new OutFlow("shellFileOutflow", fileInputFlow);
shellFileOutflow.start();