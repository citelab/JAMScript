var preCompilationJS = require("./preCompilationJS");
var jamCTranslator = require("./jamCTranslator");
var jamJSTranslator = require("./jamJSTranslator");
var callGraph = require("./callGraph");

function compile(cInput, jsInput, lineNumber, yieldPoint) {
	var libTable = [];

	// Pre-compilation State.
	preCompilationJS.compile(jsInput);
	let cTree = jamCTranslator.semanticAnalyze(cInput, lineNumber);

    // Main Compilation.
    var jsResults = jamJSTranslator.compile(
		jsInput,
		yieldPoint,
		libTable
	);

	var cResults = jamCTranslator.compile(
		cTree,
		lineNumber,
		yieldPoint,
		libTable,
		jsResults.jconds,
		jsResults.hasJdata
	);

	callGraph.pruneJSCallGraph();
	callGraph.checkCalls();

	return {
		C: cResults.C,
		JS: jsResults.JS.jsout,
		jstart: jsResults.JS.jstart,
		maxLevel: jsResults.maxLevel,
		hasJdata: jsResults.hasJdata,
	};
}

module.exports = {
	compile: compile,
};
