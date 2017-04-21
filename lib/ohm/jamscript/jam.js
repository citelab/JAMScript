var jamCTranslator = require('./jamCTranslator');
var jamJSTranslator = require('./jamJSTranslator');
var callGraph = require('./callGraph');
var activities = require('./activities');
var jdata = require('./jdata');
var symbolTable = require('./symbolTable');

function compileJS(input) {
  console.log("Parsing JS Files...");
  var jsTree = jamJSTranslator.jamJSGrammar.match(input, 'Program');
  if(jsTree.failed()) {
    throw jsTree.message;
  }
  console.log("Generating JavaScript Code...");
  return jamJSTranslator.translate(jsTree);
}

function compileC(input, jsActivities) {
  console.log("Parsing C Files...");
  var cTree = jamCTranslator.jamCGrammar.match(input, 'Source');
  if(cTree.failed()) {
    throw cTree.message;
  }
  console.log("Generating C code...");
  return jamCTranslator.translate(cTree, jsActivities);
}

function compile(cInput, jsInput) {
  var jsResults = compileJS(jsInput);
  var cResults = compileC(cInput, jsResults.jsActivities);

  callGraph.pruneJSCallGraph(jsResults.jsFunctions, jsResults.jsActivities, cResults.cActivities);
  callGraph.checkCalls(symbolTable);
  
  // annotated_JS = "/* @flow */\n" + struct_objects + annotated_JS + this.generate_js_signatures();

  return {
    'C': cResults.C, 
    'JS': jsResults.JS + cResults.JS, 
    'annotated_JS': jsResults.JS + cResults.JS
  };
}

module.exports = {
  compile: compile
}