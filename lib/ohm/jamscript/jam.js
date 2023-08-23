var jamCTranslator = require("./jamCTranslator");
var jamJsTranslator = require("./jamJsTranslator");

function compile(cInput, jsInput, lineNumber) {
	// Pre-compilation State.
	let jsTree = jamJsTranslator.semanticAnalyze(jsInput);
    // TODO the preprocessor pass should happen now... with include list
	let cTree = jamCTranslator.semanticAnalyze(cInput, lineNumber);

    // Main Compilation.
    var results = jamJsTranslator.compile(jsTree);
	results.C = jamCTranslator.compile(cTree, results.jconds, results.hasJdata);

	return results;
}

module.exports = {
	compile: compile,
};
