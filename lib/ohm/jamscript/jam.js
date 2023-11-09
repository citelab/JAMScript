const astTreeWalker = require("./astTreeWalker");
const jamCTranslator = require("./jamCTranslator");
const jamJsTranslator = require("./jamJsTranslator");
const callGraph = require("./callGraph");

const CALLGRAPH = false;

function preprocessJs(jsInput, verbosity) {
    // Pre-compilation State.
    let jsTree = jamJsTranslator.semanticAnalyze(jsInput, verbosity);

    return jsTree;
}

function getCIncludes(jsTree) {
    return jsTree.manifest.required_clibs;
}

function getCLinkerFlags(jsTree) {
    return jsTree.manifest.required_linker_flags;
}

function compile(cInput, jsTree, lineNumber, verbosity) {
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
    preprocessJs: preprocessJs,
    getCIncludes: getCIncludes,
    getCLinkerFlags: getCLinkerFlags,
};
