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

// jsInput = `
// jcond {
//     fogonly: jsys.type == "fog";
// }


// jsync {fogonly} function getid() {
//     console.log("Returning.. ", count);
//     return count++;
// }

// function koko() {
//     if (true) {

//         if (true) {
//             var lolo = 1;   
//         }

//         while (true) {
//             var koko = 2;
//         }

//         var lplp = getid();

//     }

//     while (true) {
//         var c = 3;
//     }

//     var a = koko();

//     a = 1;
// };

// jasync function you(s) {
//     console.log("You - Message from C ", s);
// }

// if (jsys.type == 'device') {
//     koko();
//     you();
// }


// `;

// cInput = `
// int getid();
// void you(char *s);

// int q;
// jasync localme(int c, char *s)
// {
//     int a = getid();
//     getbb();

//     while(1)
//     {
//         jsleep(2000);
//         q = getid();
//         printf("############-->>> Hello  ME  %d... %s... %d", c, s, q);
//     }
// }

// jasync localyou(int c, char *s)
// {
//   while(1)
//     {
//       jsleep(1000);
//       printf("############-->>> Hello YOU  %d, %s", c, s);
//       you(s);
//     }
// }

// int main(int argc, char *argv[])
// {
//   localme(10, "cxxxxyyyy");
//   localyou(10, "cxxxxxxxx");
// }
//     `

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
