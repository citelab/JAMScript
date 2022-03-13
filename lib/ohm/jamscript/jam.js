var preCompilationJS = require('./preCompilationJS');
var preCompilationC = require('./preCompilationC');
var jamCTranslator = require('./jamCTranslator');
var jamJSTranslator = require('./jamJSTranslator');
var callGraph = require('./callGraph');
var symbolTable = require('./symbolTable');
const VarTableFile = require('./VarTable');


function compile(cInput, jsInput, lineNumber, yieldPoint) {
    let cTableManager = new VarTableFile.TableManager(new VarTableFile.VarTable(null));
    let jsTableManager = new VarTableFile.TableManager(new VarTableFile.VarTable(null));
    cTableManager.setCheckSideEffect(true);
    jsTableManager.setCheckSideEffect(true);
    console.log("Side effect checking enabled");

    var libTable = [];

    // Pre-compilation State.
    var js = preCompilationJS.compile(jsInput, jsTableManager, yieldPoint, libTable);
    var c = preCompilationC.compile(cInput, lineNumber, cTableManager, yieldPoint, libTable);

    // Main Compilation.
    var jsResults = jamJSTranslator.compile(jsInput, jsTableManager, yieldPoint, libTable);
    var cResults = jamCTranslator.compile(cInput, lineNumber, cTableManager, yieldPoint, libTable);

    callGraph.pruneJSCallGraph();
    callGraph.checkCalls();

    var preamble = "\njsys = jworklib.getjsys();\n";
    if (jsResults.hasJdata)
        preamble += "jman = new JAMManager(jworklib.getcmdopts(), jsys);\n";

    return {
        'C': cResults.C,
        'JS': jsResults.JS.requires + '\nfunction userProgram() {' + preamble + cResults.JS + jsResults.JS.jsout + '\n}\njworklib.run(function() { console.log("JAMLib 1.0beta Initialized."); userProgram(); } );\n',
        'annotated_JS': jsResults.JS.jsout + cResults.JS,
        'maxLevel': jsResults.maxLevel,
        'hasJdata': jsResults.hasJdata,
        'C_SideEffectTable': cTableManager.getSideEffectResult(),
        'JS_SideEffectTable': jsTableManager.getSideEffectResult()
    };
}

module.exports = {
    compile: compile
};
