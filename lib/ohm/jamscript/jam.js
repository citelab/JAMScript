var jamCTranslator = require('./jamCTranslator');
var jamJSTranslator = require('./jamJSTranslator');
var callGraph = require('./callGraph');
var symbolTable = require('./symbolTable');

function compile(cInput, jsInput, jsPort) {
    var jsResults = jamJSTranslator.compile(jsInput, jsPort);
    var cResults = jamCTranslator.compile(cInput);

    callGraph.pruneJSCallGraph();
    callGraph.checkCalls();

    // annotated_JS = "/* @flow */\n" + struct_objects + annotated_JS + this.generate_js_signatures();

    return {
        'C': cResults.C,
        'JS': jsResults.JS.requires + '\nfunction userProgram() {\n'  + cResults.JS + jsResults.JS.jsout + '\n}\njamlib.run(function() { console.log("JAMLib 1.0beta Initialized."); userProgram(); } );\n',
        'annotated_JS': jsResults.JS.jsout + cResults.JS,
        'maxLevel': jsResults.maxLevel,
        'jView': (function() {
            if (jsPort)
                return jsResults.jView;
            else
                return "";
            })()
    };
}

module.exports = {
    compile: compile
};
