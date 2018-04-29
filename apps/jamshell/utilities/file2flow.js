function func(param) {
  return param;
}

var inFile = 'fs://' + jsys.iflow;

jdata {
  f as flow with func of inFile;
  fout as outflow of f;
}

fout.setName(jsys.oflow);
fout.start();
