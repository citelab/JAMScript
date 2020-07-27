var jamCTranslator = require('./jamCTranslator');
var jamJSTranslator = require('./jamJSTranslator');
var callGraph = require('./callGraph');
var symbolTable = require('./symbolTable');
const VarTableFile = require('./VarTable');


function compile(cInput, jsInput, lineNumber) {
    let cTableManager = new VarTableFile.TableManager(new VarTableFile.VarTable(null));
    let jsTableManager = new VarTableFile.TableManager(new VarTableFile.VarTable(null));
    cTableManager.setCheckSideEffect(true);
    jsTableManager.setCheckSideEffect(true);
    console.log("Side effect checking enabled");
    var jsResults = jamJSTranslator.compile(jsInput, jsTableManager);
    var cResults = jamCTranslator.compile(cInput, lineNumber, cTableManager);

    callGraph.pruneJSCallGraph();
    callGraph.checkCalls();

    var preamble = "\njsys = jworklib.getjsys();\n";
    if (jsResults.hasJdata)
        preamble += "jman = new JAMManager(jworklib.getcmdopts(), jsys);\n";

    console.log(jsTableManager.getSideEffectResult());

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
