const astTreeWalker = require("./astTreeWalker");
const jamCTranslator = require("./jamCTranslator");
const jamJsTranslator = require("./jamJsTranslator");
const callGraph = require("./callGraph");

const CALLGRAPH = false;

function compile(cInput, jsInput, lineNumber, verbosity) {
    // Pre-compilation State.
    let jsTree = jamJsTranslator.semanticAnalyze(jsInput, verbosity);
    // TODO the preprocessor pass should happen now... with include list
    let cTree = jamCTranslator.semanticAnalyze(cInput, lineNumber, verbosity);
    cTree = jamCTranslator.translateNamespaceAccess(cTree);

    if (CALLGRAPH) {
        astTreeWalker(callGraph.createCallGraphC).walk(cTree);
        callGraph.printCallGraph("callgraph.dot");
    }

    // Main Compilation.
    let results = jamJsTranslator.compile(jsTree, verbosity);
    results.C = jamCTranslator.compile(cTree, results.jconds, results.hasJdata, verbosity);
    return results;
}

module.exports = {
    compile: compile,
};
