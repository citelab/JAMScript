var jamCTranslator = require('./jamCTranslator');
var jamJSTranslator = require('./jamJSTranslator');
var callGraph = require('./callGraph');
var symbolTable = require('./symbolTable');
const VarTableFile = require('./VarTable');


function compile(cInput, jsInput, lineNumber) {
    let tableManager = new VarTableFile.TableManager(new VarTableFile.VarTable(null));
    tableManager.setCheckSideEffect(true);
    console.log("Side effect checking enabled");
    var jsResults = jamJSTranslator.compile(jsInput);
    var cResults = jamCTranslator.compile(cInput, lineNumber, tableManager);

    callGraph.pruneJSCallGraph();
    callGraph.checkCalls();

    var preamble = "\njsys = jworklib.getjsys();\n";
    if (jsResults.hasJdata)
        preamble += "jman = new JAMManager(jworklib.getcmdopts(), jsys);\n";

    if (tableManager.getCheckSideEffect()) {
        console.log("***********" + tableManager.getHasSideEffect());
    }

    return {
        'C': cResults.C,
        'JS': jsResults.JS.requires + '\nfunction userProgram() {' + preamble + cResults.JS + jsResults.JS.jsout + '\n}\njworklib.run(function() { console.log("JAMLib 1.0beta Initialized."); userProgram(); } );\n',
        'annotated_JS': jsResults.JS.jsout + cResults.JS,
        'maxLevel': jsResults.maxLevel,
        'hasJdata': jsResults.hasJdata
    };
}

function compileC(cInput) {
    var cResults = jamCTranslator.compile(cInput);
    return cResults.C;
}

function compileJS(jsInput) {
    var jsResults = jamJSTranslator.compile(jsInput);
    return jsResults;
}

module.exports = {
    compile: compile,
    compileC: compileC,
    compileJS: compileJS
};
