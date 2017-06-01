const JAMIopad = require("./jamiopad.js"),
	  JAMLogger = require("./jamlogger.js"),
	  JAMManager = require("./jammanager.js");

// initialize datasources
JAMIopad.getIopad("a[DEFAULT_APP].ns[global].dSources[iopad]", function(response){
	console.log(response.new_data);
});
