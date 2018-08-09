function func(param) {
  return param;
}

var array = [];

jdata {
  fin as inflow;
  f as flow with func of array;
  fout as outflow of f;
}

fout.setName(jsys.oflow);

fin.setTerminalFunction(function(data) {
  fout.push(data);
});

fin.openFlow(jsys.iflow);
