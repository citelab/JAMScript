var ohm = require('ohm-js'),
    jam = require('./lib/ohm/jamscript/jam'),
    fs = require('fs'),
    JSZip = require('jszip'),
    child_process = require('child_process'),
    crypto = require('crypto'),
    path = require('path');

var cc;
var outputName;
var preprocessDecls;

// Flags
var debug = false,
    noCompile = false,
    parseOnly = false,
    preprocessOnly = false,
    translateOnly = false,
    verbose = false;

// Process arguments
var args = process.argv.slice(2);
var jamlibPath = args[0];
var tmpDir = "/tmp/jam-" + randomValueHex(20);
var cPath = undefined;
var jsPath = undefined;

for (var i = 1; i < args.length; i++) {
  if(args[i].charAt(0) == "-") {
    if(args[i] == "-A") { // Parser only
      parseOnly = true;
    } else if(args[i] == "-D") { // Debug mode
      debug = true;
    } else if(args[i] == "-help") { // help
      printHelp();
    } else if(args[i] == "-N") { // Don't compile
      noCompile = true;
    } else if(args[i] == "-P") { // Preprocessor only
      preprocessOnly = true;
    } else if(args[i] == "-V") { // Verbose
      verbose = true;
    } else if(args[i] == "-T") { // Translator only
      translateOnly = true;
    }
  } else {
    var inputPath = args[i];
    var extension = path.extname(inputPath);
    if(extension == '.js') {
      jsPath = inputPath;
    } else if(extension == '.c') {
      cPath = inputPath;
    }
  }
}

var inputError = false;
if(cPath === undefined) {
  console.error("Error: C input file not specified");
  inputError = true;
} else if(!fs.existsSync(cPath)) {
  console.error("File not found: " + cPath);
  inputError = true;
}
if(jsPath === undefined) {
  console.error("Error: JavaScript input file not specified");
  inputError = true;
} else if(!fs.existsSync(jsPath)) {
  console.error("File not found: " + jsPath);
  inputError = true;
}
if(inputError) {
  // inputArgsError();
  process.exit(1);
}

// if(inputPath === undefined) {
//   inputArgsError();
//   process.exit(1);
// }


try {
  fs.mkdirSync(tmpDir);
  try {
    var preprocessed = preprocess(cPath);
  } catch(e) {
    console.log("Exiting with preprocessor error");
    process.exit();
  }
  if(preprocessOnly) {
    printAndExit(preprocessed);
  }
  if(verbose) {
    console.log(preprocessed);
  }

  console.log("Parsing JS Files...");
  var jsTree = jam.jamJSGrammar.match(fs.readFileSync(jsPath).toString(), 'Program');
  if(jsTree.failed()) {
    throw jsTree.message;
  }

  console.log("Parsing C Files...");
  var cTree = jam.jamCGrammar.match(preprocessed, 'Source');
  if(cTree.failed()) {
    throw cTree.message;
  }

  if(parseOnly) {
    printAndExit(cTree + jsTree);
  }
  if(verbose) {
    console.log(cTree);
    console.log(jsTree);
  }

  console.log("Generating JavaScript Code...");
	var jsOutput = jam.jsSemantics(jsTree).jamJSTranslator;
  console.log("Generating C code...");
	var cOutput = jam.cSemantics(cTree).jamCTranslator;
  
  // fs.writeFileSync("callgraph.html", createCallGraphWebpage(jam.callGraph.getCallGraph()));
  fs.writeFileSync("callgraph.html", createCallGraphWebpageCytoscape(jam.callGraph.getCallGraph()));

  fs.writeFileSync("callgraph.dot", createDOTCallgraph(jam.callGraph.getCallGraph()));

  // if(translateOnly) {
  //   printAndExit(output);
  // }
  // if(verbose) {
  //   console.log(output);
  // }


  // fs.writeFileSync("/usr/local/share/jam/lib/jamlib/c_core/jamlib.c", output.C);
  // child_process.execSync("make -C /usr/local/share/jam/lib/jamlib/c_core");
  // fs.createReadStream('/usr/local/share/jam/lib/jamlib/c_core/testjam').pipe(fs.createWriteStream('jamout'));
  // fs.createReadStream('/usr/local/share/jam/lib/jamlib/c_core/jamconf.dat').pipe(fs.createWriteStream('jamconf.dat'));

  fs.writeFileSync("jamout.js", jsOutput.JS + cOutput.JS);

  if(!noCompile) {
    console.log("Compiling C code...");
    // Set platform options
    var options = "";
    if(process.platform != "darwin") {
      options = "-lm -lbsd";
    }

    flowCheck(jsOutput.annotated_JS + cOutput.annotated_JS);
    var includes = '#include "jam.h"\n'
    includes = '#include "command.h"\n' + includes;
    includes = '#include "jdata.h"\n' + includes;
    includes = '#include <unistd.h>\n' + includes;

    fs.writeFileSync("jamout.c", includes + preprocessDecls.join("\n") + "\n" + cOutput.C + jsOutput.C);
    fs.writeFileSync(`${tmpDir}/jamout.c`, includes + preprocessDecls.join("\n") + "\n" + cOutput.C + jsOutput.C);
    try {
      child_process.execSync(`clang -g ${tmpDir}/jamout.c -I/usr/local/include -I/usr/local/share/jam/lib/ ${options} -pthread -lcbor -lnanomsg /usr/local/lib/libjam.a -ltask -levent -lhiredis -L/usr/local/lib -lpaho-mqtt3c -framework CoreFoundation`, {stdio: [0,1,2]}) ;
    } catch(e) {
    }
    // child_process.execSync(`gcc -Wno-incompatible-library-redeclaration -shared -o ${tmpDir}/libjamout.so -fPIC ${tmpDir}/jamout.c ${jamlibPath} -lpthread`);
    // createZip(createTOML(), output.JS, tmpDir, outputName);
    
    // if(!debug) {
    //   deleteFolderRecursive(tmpDir);
    // }
  }
} catch(e) {
    console.log("ERROR:");
    console.log(e);
}

function printAndExit(output) {
  console.log(output);
  process.exit();
}

function preprocess(file) {
  console.log("Preprocessing...");

  var contents = fs.readFileSync(file).toString();
  preprocessDecls = contents.match(/^[#;].*/gm);
  if(preprocessDecls == null) {
    preprocessDecls = [];
  }
  var includes = '#include "jam.h"\n';

  contents = includes + "int main();\n" + contents;
  
  fs.writeFileSync(`${tmpDir}/pre.c`, contents);
  return result = child_process.execSync(`clang -E -P -I/usr/local/include -I/usr/local/share/jam/deps/fake_libc_include -I/usr/local/share/jam/lib ${tmpDir}/pre.c`).toString();

  // return child_process.execSync(`${cc} -E -P -std=iso9899:199409 ${file}`).toString();

}

function flowCheck(input) {
  // Returns empty buffer if flow installed
  var hasFlow = child_process.execSync("flow version >/dev/null 2>&1 || { echo 'not installed';}");
  
  if(hasFlow.length == 0) {
    fs.writeFileSync(`${tmpDir}/.flowconfig`, "");
    fs.writeFileSync(`${tmpDir}/annotated.js`, input);
    const child = child_process.exec(`flow ${tmpDir}/annotated.js --color always`, (error, stdout, stderr) => {
        if (error !== null) {
          console.log("JavaScript Type Checking Error:");
          console.log(stdout.substring(stdout.indexOf("\n") + 1));
        } else {
          console.log("No Flow JavaScript errors found");
        }
    });
    // const child = child_process.exec('flow check-contents --color always', (error, stdout, stderr) => {
    //     if (error !== null) {
    //       console.log("JavaScript Type Checking Error:");
    //       console.log(stdout.substring(stdout.indexOf("\n") + 1));
    //     }
    // });
    // child.stdin.write(input);
    // child.stdin.end();
  } else {
    console.log("Flow not installed, skipping JavaScript typechecking");
  }
}

function createCallGraphWebpage(callGraph) {
  var output = "";
  output += '<html>\n';
  output += '<head>\n';
  output += '<script type="text/javascript" src="https://cdnjs.cloudflare.com/ajax/libs/vis/4.19.1/vis.min.js"></script>\n';
  output += '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/vis/4.19.1/vis.min.css" />\n';
  output += '<style type="text/css"> #mynetwork { width: 600px; height: 400px; border: 1px solid lightgray; } </style>\n';
  output += '<title>Callgraph</title>\n';
  output += '</head>\n';
  output += '<body>\n';
  output += '<div id="mynetwork"></div>\n';
  output += '<script>\n';
  output += printCallGraph(callGraph);
  output += 'var container = document.getElementById("mynetwork");\n';
  output += 'var data = {\n';
  output += '  nodes: nodes,\n';
  output += '  edges: edges\n';
  output += '}\n';
  output += 'var options = {};\n';
  output += 'var network = new vis.Network(container, data, options);\n';
  output += '</script>\n';
  output += '</body>\n';
  output += '</html>\n';
  return output;
}
function printCallGraph(callGraph) {
    var output = 'var nodes = new vis.DataSet([\n';
    var nodeId = 0;
    var nodeMap = new Map();

    var callList = '';
    if(callGraph.c.size > 0) {
        var usedFunctions = new Set();
        callGraph.c.forEach(function(calls, func) {
            usedFunctions.add(func);
        });
        usedFunctions.forEach(function(func) {
            nodeMap.set(func, nodeId);
            output += '{id: ' + nodeId + ', label: "' + func + '", group: 0},\n';
            nodeId++;
        });
    }
    if(callGraph.js.size > 0) {
        var usedFunctions = new Set();
        callGraph.js.forEach(function(calls, func) {
            usedFunctions.add(func);
        });
        usedFunctions.forEach(function(func) {
            nodeMap.set(func, nodeId);
            output += '{id: ' + nodeId + ', label: "' + func + '", group: 1},\n';
            nodeId++;
        });
    }
    output += ']);\n';
    output += 'var edges = new vis.DataSet([\n';
    if(callGraph.c.size > 0) {
      callGraph.c.forEach(function(calls, func) {
        calls.forEach(function(arguments, call) {
          arguments.forEach(function(args) {
            output += '{from: ' + nodeMap.get(func) + ', to: ' + nodeMap.get(call) + ', label: "' + args + '", arrows:"to"},\n';
          });
        });
      });
    }
    if(callGraph.js.size > 0) {
      callGraph.js.forEach(function(calls, func) {
        calls.forEach(function(arguments, call) {
          arguments.forEach(function(args) {
            output += '{from: ' + nodeMap.get(func) + ', to: ' + nodeMap.get(call) + ', label: "' + args + '", arrows:"to"},\n';
          });
        });
      });
    }
    output += ']);\n';
    return output;
};


function createCallGraphWebpageCytoscape(callGraph) {
  var output = "";
  output += '<html>\n';
  output += '<head>\n';
  output += '<script type="text/javascript" src="http://ajax.googleapis.com/ajax/libs/jquery/1/jquery.min.js"></script>\n';
  output += '<script type="text/javascript" src="http://cytoscape.github.io/cytoscape.js/api/cytoscape.js-latest/cytoscape.min.js"></script>\n';
  output += '<script src="http://marvl.infotech.monash.edu/webcola/cola.v3.min.js"></script>\n';
  output += '<script src="https://cdn.rawgit.com/cytoscape/cytoscape.js-qtip/2.2.5/cytoscape-qtip.js"></script>\n';
  output += '<script src="https://cdn.rawgit.com/cytoscape/cytoscape.js-cola/1.1.1/cytoscape-cola.js"></script>\n';
  output += '<script src="http://cpettitt.github.io/project/dagre/latest/dagre.min.js"></script>\n';
  output += '<script src="https://cdn.rawgit.com/cytoscape/cytoscape.js-dagre/1.4.0/cytoscape-dagre.js"></script>\n';
  output += '<style type="text/css"> #cy { height: 100%; width: 100%; position: absolute; left: 0; top: 0; } </style>\n';
  output += '<title>Callgraph</title>\n';
  output += '<script>\n';
  output += printCallGraphCytoscape(callGraph);
  output += `$(function(){
  var cy = cytoscape({
  container: document.getElementById('cy'),
  
  boxSelectionEnabled: false,
  autounselectify: true,
  
  style: [
    {
      selector: 'node',
      css: {
        'content': 'data(id)',
        'text-valign': 'center',
        'text-halign': 'center',
        'width': '100'
      }
    },
    {
      selector: '$node > node',
      css: {
        'text-valign': 'top',
        'text-halign': 'center'
      }
    },
    {
      selector: 'edge',
      css: {
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'content': 'data(label)'
      }
    }
  ],
  elements: {
    nodes: nodes,
    edges: edges
  },
  layout: {
    name: 'dagre'
  }
  });
  });\n`;
  output += '</script>\n';
  output += '</head>\n';
  output += '<body>\n';
  output += '<div id="cy"></div>\n';
  output += '</body>\n';
  output += '</html>\n';
  return output;
}
function printCallGraphCytoscape(callGraph) {
    var output = 'var nodes = [ \n';
    output += `{data: {id: "c"}},\n`;
    output += `{data: {id: "js"}},\n`;

    if(callGraph.c.size > 0) {
        var usedFunctions = new Set();
        callGraph.c.forEach(function(calls, func) {
            usedFunctions.add(func);
        });
        usedFunctions.forEach(function(func) {
            output += `{data: {id: "${func}", parent: 'c'}},\n`;
        });
    }
    if(callGraph.js.size > 0) {
        var usedFunctions = new Set();
        callGraph.js.forEach(function(calls, func) {
            usedFunctions.add(func);
        });
        usedFunctions.forEach(function(func) {
            output += `{data: {id: "${func}", parent: 'js'}},\n`;
        });
    }
    
    output += '];\n';
    output += 'var edges = [\n'; 
    if(callGraph.c.size > 0) {
      callGraph.c.forEach(function(calls, func) {
        calls.forEach(function(arguments, call) {
          arguments.forEach(function(args) {
            output += `{data: {id: "${func+call}", source: "${func}", target: "${call}", label: "${args.slice(1,-1)}"}},\n`;
          });
        });
      });
    }
    if(callGraph.js.size > 0) {
      callGraph.js.forEach(function(calls, func) {
        calls.forEach(function(arguments, call) {
          arguments.forEach(function(args) {
            output += `{data: {id: "${func+call}", source: "${func}", target: "${call}", label: "${args.slice(1,-1)}"}},\n`;
          });
        });
      });
    }
    output += '];\n';
    return output;
};

function createDOTCallgraph(callGraph) {
    var graph = 'digraph jamgraph{\n';
    var callList = '';
    if(callGraph.c.size > 0) {
        var usedFunctions = new Set();
        graph += 'subgraph cluster_0 {\n';
        graph += 'label = "C Functions";\n'
        callGraph.c.forEach(function(calls, func) {
            // graph += func + ';\n';
            // if(calls.size > 0) {
              usedFunctions.add(func);
            // }
            calls.forEach(function(arguments, call) {
              arguments.forEach(function(args) {
                callList += func + ' -> ' + call + ' [ label="' + args + '" ];\n';
                if(callGraph.c.has(call)) {
                    usedFunctions.add(call);
                }
              });
            });
        });
        usedFunctions.forEach(function(func) {
            graph += func + ';\n';
        });
        graph += '}\n'
    }
    if(callGraph.js.size > 0) {
        var usedFunctions = new Set();
        graph += 'subgraph cluster_1 {\n';
        graph += 'label = "J Functions";\n'
        callGraph.js.forEach(function(calls, func) {
            // graph += func + ';\n';
            usedFunctions.add(func);
            calls.forEach(function(arguments, call) {
              arguments.forEach(function(args) {
                callList += func + ' -> ' + call + ' [ label="' + args + '" ];\n';
                if(callGraph.js.has(call)) {
                    usedFunctions.add(call);
                }
              });
            });
        });
        usedFunctions.forEach(function(func) {
            graph += func + ';\n';
        });
        graph += '}\n'
    }
    
    graph += callList;
    graph += '}';
    return graph;
};

function createZip(toml, jsout, tmpDir, outputName) {
  var zip = new JSZip();
  zip.file("MANIFEST.tml", toml);
  zip.file("jamout.js", fs.readFileSync('/usr/local/share/jam/lib/jserver/jserver-clean.js') + jsout);
  zip.file("libjamout.so", fs.readFileSync(`${tmpDir}/libjamout.so`));
  fs.writeFileSync(`${outputName}.jxe`, zip.generate({type:"nodebuffer"}));
}

function createTOML() {
  var toml = "";
  toml += "# Description of the JXE structure\n";
  toml += "title = \"JAMScript Executable Description\"\n";

  toml += "# global identification and requirements are specified next\n";
  toml += "[jxe]\n";
  toml += "version = 1.0\n";
  toml += "checksum = \"XXXDFDFDFDFDF\"\n";
  toml += "requirements = \"none\"\n";

  toml += "# javascript portion is in one file for now\n";
  toml += "[jsfile]\n";
  toml += "# any or a particular version can be specified for nodeversion\n";
  toml += "nodeversion = 0\n";
  toml += "# list of modules that should be pre-loaded into Node\n";
  toml += "requires = []\n";
  toml += "# file name for the javascript code\n";
  toml += "file = \"jamout.js\"\n";

  toml += "# c portion could be in multiple files (in shared lib format)\n";
  toml += "[cfile]\n";
  toml += "portions = 1\n";
  toml += "# definition of a C portion\n";
  toml += "[cfile.1]\n";
  toml += "# architecture for which the shared library is genereated\n";
  toml += "arch = \"x86\"\n";
  toml += "# requirements of the shared library; these are tags that indicate the requirements\n";
  toml += "requires = []\n";
  toml += "# filename of the shared library\n";
  toml += "file = \"libjamout.so\"\n";
  return toml;
}

function inputArgsError() {
  console.error("No input file specified");
  console.error("Input format:");
  console.error("\tjamc [options] <input file> <output name>");
}

function randomValueHex(len) {
    return crypto.randomBytes(Math.ceil(len/2))
        .toString('hex') // convert to hexadecimal format
        .slice(0,len);   // return required number of characters
}

function deleteFolderRecursive(path) {
  if( fs.existsSync(path) ) {
    fs.readdirSync(path).forEach(function(file,index){
      var curPath = path + "/" + file;
      if(fs.lstatSync(curPath).isDirectory()) { // recurse
        deleteFolderRecursive(curPath);
      } else { // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
}

function printHelp() {
  console.log("USAGE: jamc [options] <inputs> <output name>");
  console.log("\nOptions:");
  console.log("\t-A \t\t\t Parser only");
  console.log("\t-D \t\t\t Debug mode");
  console.log("\t-help \t\t\t Display available options");
  console.log("\t-N \t\t\t Skip compilation");
  console.log("\t-P \t\t\t Preprocessor only");
  console.log("\t-V \t\t\t Verbose mode");
  console.log("\t-T \t\t\t Translator only");
  process.exit();
}
