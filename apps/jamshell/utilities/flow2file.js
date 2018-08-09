var fs = require('fs');

var outFile = fs.createWriteStream(jsys.oflow);

jdata {
  fin as inflow;
}

fin.setTerminalFunction(function(data) {
  outFile.write(data);
});

fin.openFlow(jsys.iflow);
