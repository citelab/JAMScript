var jamCTranslator = require("./jamCTranslator");
var jamJsTranslator = require("./jamJsTranslator");
var callGraph = require("./callGraph");

function compile(cInput, jsInput, lineNumber, yieldPoint) {
	// Pre-compilation State.
	let jsTree = jamJsTranslator.semanticAnalyze(jsInput);
    // TODO the preprocessor pass should happen now... with include list
	let cTree = jamCTranslator.semanticAnalyze(cInput, lineNumber);

    // Main Compilation.
    var jsResults = jamJsTranslator.compile(jsTree);

    // TODO
	var cResults = jamCTranslator.compile(cTree, yieldPoint, [], false);

	callGraph.pruneJSCallGraph();
	callGraph.checkCalls();

    // TODO should include library list with return... to include
	return {
		C: cResults.C,
		JS: jsResults.JS.jsout,
		jstart: jsResults.JS.jstart,
		hasJdata: jsResults.hasJdata,
	};
}

module.exports = {
	compile: compile,
};
