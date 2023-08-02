var preCompilationJS = require("./preCompilationJS");
var jamCTranslator = require("./jamCTranslator");
var jamJSTranslator = require("./jamJSTranslator");
var callGraph = require("./callGraph");

function compile(cInput, jsInput, lineNumber, yieldPoint) {
	// Pre-compilation State.
	let jsTree = preCompilationJS.compile(jsInput);
    // TODO the preprocessor pass should happen now... with include list
	let cTree = jamCTranslator.semanticAnalyze(cInput, lineNumber);

    // Main Compilation.
    var jsResults = jamJSTranslator.compile(
        jsTree,
		yieldPoint
	);

	var cResults = jamCTranslator.compile(
		cTree,
		yieldPoint,
		jsResults.jconds,
		jsResults.hasJdata
	);

	callGraph.pruneJSCallGraph();
	callGraph.checkCalls();

    // TODO should include library list with return... to include
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
