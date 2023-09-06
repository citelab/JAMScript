const astTreeWalker = require("./astTreeWalker");
const jamCTranslator = require("./jamCTranslator");
const jamJsTranslator = require("./jamJsTranslator");
const callGraph = require("./callGraph");

const CALLGRAPH = false;

function compile(cInput, jsInput, lineNumber) {
    // Pre-compilation State.
    let jsTree = jamJsTranslator.semanticAnalyze(jsInput);
    // TODO the preprocessor pass should happen now... with include list
    let cTree = jamCTranslator.semanticAnalyze(cInput, lineNumber);
    cTree = jamCTranslator.translateNamespaceAccess(cTree);

    if (CALLGRAPH) {
        astTreeWalker(callGraph.createCallGraphC).walk(cTree);
        callGraph.printCallGraph("callgraph.dot");
    }

    // Main Compilation.
    let results = jamJsTranslator.compile(jsTree);
    results.C = jamCTranslator.compile(cTree, results.jconds, results.hasJdata);

    return results;
}

module.exports = {
    compile: compile,
};
