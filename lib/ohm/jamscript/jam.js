/* eslint-env node */

'use strict';

// --------------------------------------------------------------------
// Imports
// --------------------------------------------------------------------

var fs = require('fs');
var path = require('path');

var ohm = require('ohm-js');
var cTranslator = require('../c/c').cTranslator;
var es5Translator = require('../ecmascript/es5').es5Translator;
var symbolTable = require('./symbolTable');
var activityMatrix = require('./activityMatrix.json');


var namespace_funcs    = [];

var currentFunction    = "";
var jsFunctions        = new Set();
var jsActivities       = new Map();
var jConditions        = new Map();
var activities         = new Map();
var prototypes         = new Map();
var cActivities        = new Map();
var cCallbackActivities = new Set();

var callGraph = {
  graph: {
    c: new Map(),
    js: new Map()
  },
  addFunction: function(language, name) {
    if(!this.graph[language].has(name)) {
      this.graph[language].set(name, {
        type: 'function',
        calls: new Map()
      });
    }
  },
  addActivity: function(language, name, type) {
    if(!this.graph[language].has(name)) {
      this.graph[language].set(name, {
        type: type,
        calls: new Map()
      });
    }
  },
  addCall: function(language, source, destination, parameters) {
    var sourceFunctionCalls = this.graph[language].get(source).calls;
    var destinationArgumentCalls = sourceFunctionCalls.get(destination);

    if(destinationArgumentCalls == undefined) {
      sourceFunctionCalls.set(destination, new Set([parameters]));
    } else {
      destinationArgumentCalls.add(parameters);
    }
  },
  resetCallGraph: function(language) {
    this.graph[language] = new Map();
  },
  pruneJSCallGraph: function() {
    this.graph.js.forEach(function(target, sourceFunction, map) {
      var calls = target.calls;
      for (let call of calls.keys()) {
        if(!(jsFunctions.has(call) || jsActivities.has(call) || cActivities.has(call))) {
          calls.delete(call);
        }
      }
    });
  },
  getCallGraph: function() {
    return this.graph;
  },
  checkCalls: function() {
    // this.graph.js.forEach(function(data, sourceFunction) {
    //   var sourceSymbol = symbolTable.get(sourceFunction);
    //   for (let call of data.calls.keys()) {
    //     var targetSymbol = symbolTable.get(call);
    //     if(data.type !== "function") {
    //       if(!activityMatrix['js'][data.type][targetSymbol.language][targetSymbol.activityType]) {
    //         error(`Cannot call ${targetSymbol.language} ${targetSymbol.activityType} activity ${call} from ${language} ${data.type} activity ${sourceFunction}`);
    //       }
    //     }
    //     if(targetSymbol.language === "js" && targetSymbol.activityType === "sync") {
    //       error(`Cannot call javascript synchrnous activity ${call} from function ${sourceFunction}, javscript sync calls must be at top level`);
    //     }
    //   }
    // });
    // this.graph.c.forEach(function(data, sourceFunction) {
    //   var sourceSymbol = symbolTable.get(sourceFunction);
    //   for (let call of data.calls.keys()) {
    //     if(data.type !== "function") {
    //       var targetSymbol = symbolTable.get(call);
    //       if(!activityMatrix['js'][data.type][targetSymbol.language][targetSymbol.activityType]) {
    //         error(`Cannot call ${targetSymbol.language} ${targetSymbol.activityType} activity ${call} from ${language} ${data.type} activity ${sourceFunction}`);
    //       }
    //     }
    //   }
    // });

    for (const language of Object.keys(this.graph)) {
      var entries = this.graph[language];
      entries.forEach(function(data, sourceFunction, map) {
        var sourceSymbol = symbolTable.get(sourceFunction);
        if(data.type != "function") {
          for (let call of data.calls.keys()) {
            var targetSymbol = symbolTable.get(call);
            if(!activityMatrix['js'][data.type][targetSymbol.language][targetSymbol.activityType]) {
              error(`Cannot call ${targetSymbol.language} ${targetSymbol.activityType} activity ${call} from ${language} ${data.type} activity ${sourceFunction}`);
            }
          }
        }
      });
    }
  }
};

var types = {
              'int': {
                  c_pattern: '%i',
                  jamlib: 'ival',
                  js_type: 'number',
                  c_code: 'i',
                  js_code: 'n',
                  caster: 'atoi',
                  jbroadcast: 'JBROADCAST_INT'
              },
              'float': {
                  c_pattern: '%f',
                  jamlib: 'dval',
                  js_type: 'number',
                  c_code: 'f',
                  js_code: 'n',
                  caster: 'atof',
                  jbroadcast: 'JBROADCAST_FLOAT'
              },
              'char*': {
                  c_pattern: '\\"%s\\"',
                  jamlib: 'sval',
                  js_type: 'string',
                  c_code: 's',
                  js_code: 's',
                  caster: null,
                  jbroadcast: 'JBROADCAST_STRING'
              },
              'char': {
                  c_pattern: '\\"%s\\"',
                  jamlib: 'sval',
                  js_type: 'string',
                  c_code: 's',
                  js_code: 's',
                  caster: null,
                  jbroadcast: 'JBROADCAST_STRING'
              },
              'jcallback': {
                  c_pattern: '\\"%s\\"',
                  jamlib: 'sval',
                  js_type: 'string',
                  c_code: 's',
                  js_code: 's',
                  caster: null,
                  jbroadcast: null
              }
            };

function error(message) {
  throw message;
}

// function generate_c_async_callbacks(callbackFuncs) {
//   var cout = '';

//   callbackFuncs.forEach(function(value, key) {
//     var c_codes = [];
//     cout += 'void *call' + key + '(void *act, void *arg) {\n';
//     cout += 'command_t *cmd = (command_t *)arg;\n';
//     cout += key + '(';

//     for (var i = 0; i < value.length; i++) {
//       var param = value[i];
//       var pointer = '';
//       if(param.pointer != undefined) {
//         pointer = ' ' + CTranslator.match(param.pointer, 'walk').trim();
//       }

//       cout += 'cmd->args[' + i + '].val.' + types[param.type].jamlib
//       if(i < value.length - 1 ) {
//         cout += ', ';
//       }

//       c_codes.push(types[param.type].c_code);
//     }
//     cout += ');\n';
//     cout += '}\n';
    
//     cActivities.set(key, {
//        codes: c_codes,
//        type: "async"}
//        );
//   });
//   return cout;
// }

function generate_js_logger_vars() {
  var jsout = '';
  var globals = symbolTable.getGlobals();
  globals.forEach(function(value, key, map) {
    if(value.type == 'jdata namespace') {
      jsout += `var ${key} = {\n`
      var children = value.children;
      children.forEach(function(v, k, m) {
        if(v.jdata_type == 'broadcaster') {
          jsout += `\t${k}: new JAMLogger(JAMManager, "${key}.${k}"),\n`;
        }
      });
      jsout += '};\n';
    } else if(value.type == 'jdata' && value.jdata_type == 'logger') {
      jsout += `var ${key} = new JAMLogger(JAMManager, "${key}");\n`;
    }
  });
  return jsout;
}

function generate_c_broadcaster_vars() {
  var cout = '';
  var globals = symbolTable.getGlobals();
  globals.forEach(function(value, key, map) {
    if(value.type == 'jdata' && value.jdata_type == 'broadcaster') {
      cout += `jbroadcaster *${key};\n`;
    } else if(value.type == "jdata namespace") {
      cout += `struct ${key} {\n`;
      var children = value.children;
      children.forEach(function(v, k, m) {
        if(v.jdata_type == 'broadcaster') {
          cout += `jbroadcaster *${k};\n`
        }
      });
      cout += `} ${key};\n`;
    }
  });
  return cout;
}

function generate_c_shuffler_vars() {
  var cout = '';
  var globals = symbolTable.getGlobals();
  globals.forEach(function(value, key, map) {
    if(value.type == 'jdata' && value.jdata_type == 'shuffler') {
      cout += `jshuffler *${key};\n`;
    }
  });
  return cout;
}

function generateJSActivities() {
  var jsOut = "";
  var annotatedJSOut = "";
  for(const [name, data] of jsActivities) {
    if (data.cParams === undefined) {
      var result = "function call" + name + "(" + data.jsParams.join(',') + ") {\n" + data.block + "\n}\n";
      jsOut += result;
      annotatedJSOut += result;
    } else {
      var result;
      if(data.activityType === "sync") {
        result = CreateJSASyncJSFunction(name, data.cParams, data.jsParams, data.block);
      } else {
        result = CreateJSSyncJSFunction(data.returnType, name, data.cParams, data.jsParams, data.block);
      }
      jsOut += result.JS;
      annotatedJSOut += result.annotated_JS;
    } 
  }
  return {
    JS: jsOut,
    annotated_JS: annotatedJSOut
  }
}

function generate_js_mbox() {
  var jsout = 'var mbox = {\n';
  jsout += '"functions": {\n';
  for(const [name, data] of jsActivities) {
    jsout += `"${name}": call${name},\n`;
  }
  jsout += '},\n';
  jsout += '"signatures": {\n';
  for(const [name, data] of jsActivities) {
    jsout += `"${name}": "${data.signature.join('')}",\n`;
  }
  jsout += '}\n';
  jsout += '}\n';
  
  jsout += 'jamlib.registerFuncs(mbox);\n';
  jsout += 'jamlib.run(function() { console.log("Running..."); } );\n';
  jsout += '}\nwait.launchFiber(main);\n'; // Close main function and launch fiber
  return jsout;
}

function generate_c_activities() {
  var cout = '';
  for(const [name, values] of cActivities) {
    cout += 'activity_regcallback(js->atable, "' + name + '", ' + values.type.toUpperCase() + ', "' + values.codes.join('') + '", call' + name + ');\n';
  }
  return cout;
}

function generate_jam_run_app() {
  var cout = '\nvoid jam_run_app(void *arg) {\n';
  cout += 'user_main();\n'
  cout += '}\n';
  return cout;
}

function linkJBroadcasterVars() {
  var cout = '';
  var globals = symbolTable.getGlobals();
  globals.forEach(function(value, key, map) {
    if(value.type == 'jdata' && value.jdata_type == 'broadcaster') {
      cout += `${key} = jambroadcaster_init(${types[value.type_spec].jbroadcast}, "global", "${key}", NULL);\n`;
    } else if(value.type == "jdata namespace") {
      var children = value.children;
      children.forEach(function(v, k, m) {
        if(v.jdata_type == 'broadcaster') {
          cout += `${key}.${k} = jambroadcaster_init(${types[v.type_spec].jbroadcast}, "${k}", "${key}", NULL);\n`;
        }
      });
    }
  });
  return cout;
}

function linkJShufflerVars() {
  var cout = '';
  var globals = symbolTable.getGlobals();
  globals.forEach(function(value, key, map) {
    if(value.type == 'jdata' && value.jdata_type == 'jshuffler') {
      cout += `${key} = jshuffler_init(JBROADCAST_STRING, "${key}", NULL);\n`;
    }
  });
  return cout;
}

function generate_c_activity_wrappers() {
  var cout = "";
  cCallbackActivities.forEach(function(fname, _, set) {
    cout += 'void call' + fname + '(void *act, void *arg) {\n';
    cout += 'command_t *cmd = (command_t *)arg;\n';
    cout += fname + '(cmd->args[0].val.sval);\n';
    cout += '}\n';
  });
  return cout;
}

function generate_setup() {
  var cout = '\nvoid user_setup() {\n';
  cout += generate_c_activities();
  cout += linkJBroadcasterVars();
  cout += linkJShufflerVars();
  cout += '}\n';
  return cout;
}                   

function generate_taskmain() {
  var cout = `\nvoid taskmain(int argc, char **argv) {\n
    if (argc > 1) {
      strncpy(app_id, argv[1], sizeof app_id - 1);
    }
    js = jam_init(1883);
    user_setup();
     
    taskcreate(jam_event_loop, js, 50000);
    taskcreate(jam_run_app, js, 50000);
  }\n`;
  return cout;
}

function CreateCASyncJSFunction(fname, jCond, params) {
  var ps = [];
  params.forEach(function(p) {
    ps.push(p.name);
  });
  var funccode = "function " + fname + "(" + ps.join(',') + ") {\n";

  for(var i = 0; i < ps.length; i++) {
    funccode += `if(typeof ${ps[i]} === "function") { ${ps[i]} = ${ps[i]}.name; }\n`;
  }

  // write the code that would call the remote function
  funccode += `jnode.remoteAsyncExec("${fname}", [ ${ps.join(',')} ], "${jCond.source}", ${jCond.code});\n`;

  // write the end of the function
  funccode += "}\n";

  return {
    JS: funccode,
    annotated_JS: funccode
  }
}

function CreateCASyncCFunction(dspec, fname, params, stmt) {
  var cout = "";
  var typed_params = [];
  var c_codes = [];
  params.forEach(function(p) {
    typed_params.push(p.type + ' ' + p.name);
    c_codes.push(types[p.type].c_code);
  });

  // Main function
  cout += 'void ' + fname + '(' + typed_params.join(", ") + ')' + stmt + '\n';

  // Calling function
  cout += 'void call' + fname + '(void *act, void *arg) {\n';
  cout += 'command_t *cmd = (command_t *)arg;\n';
  cout += fname + '(';
  for (var i = 0; i < params.length; i++) {
      cout += 'cmd->args[' + i + '].val.' + types[params[i].type].jamlib;
    if(i < params.length - 1 ) {
      cout += ', ';
    }
  }
  cout += ');\n';
  cout += '}\n';
  
  cActivities.set(fname, {
    codes: c_codes,
    type: "async"
  });
  return cout;
}

function CreateCSyncJSFunction(fname, jCond, params) {
  var ps = [];
  params.forEach(function(p) {
    ps.push(p.name);
  });

  var funccode = "function " + fname + "(" + ps.join(',') + ") {\n";

  // write the code that would call the remote function
  funccode += `yield wait.for(jnode.remoteSyncExec("${fname}", [ ${ps.join(',')} ], "${jCond.source}", ${jCond.code}));\n`;

  // write the end of the function
  funccode += "}\n";

  return {
    JS: funccode,
    annotated_JS: funccode
  }
}

function CreateCSyncCFunction(dspec, fname, params, stmt) {
  var cout = "";
  var typed_params = [];
  var c_codes = [];
  params.forEach(function(p) {
    typed_params.push(p.type + ' ' + p.name);
    c_codes.push(types[p.type].c_code);
  });

  // Main function
  cout += dspec + ' ' + fname + '(' + typed_params.join(", ") + ')' + stmt + '\n';

  // Calling function
  cout += 'void call' + fname + '(void *act, void *arg) {\n';
  cout += 'command_t *cmd = (command_t *)arg;\n';

  var funcCall = fname + '(';
  for (var i = 0; i < params.length; i++) {
    funcCall += 'cmd->args[' + i + '].val.' + types[params[i].type].jamlib
    if(i < params.length - 1 ) {
      cout += ', ';
    }
  }
  funcCall += ')';

  if(dspec != 'void') {
    cout += 'activity_complete(js->atable, cmd->actid, "' + types[dspec].c_code + '", ' + funcCall + ');\n';
  } else {
    cout += funcCall + ';\n';
    cout += 'activity_complete(js->atable, cmd->actid, "");\n';
  }
  cout += '}\n';

  cActivities.set(fname, {
    codes: c_codes,
    type: "sync"
  });
  return cout;
}

function CreateJSASyncJSFunction(fname, cParams, jParams, stmt) {
  var ps = [];
  var annotated_ps = [];

  for (var i = 0; i < cParams.length; i++) {
    if(cParams[i] == "jcallback") {
      stmt = `${jParams[i]} = function(x) { jnode.remoteAsyncExec(_${i}, [x], "true", 0); }\n` + stmt;
      var jcallbackCode = "";
      // jcallbackCode += 'if(nodeType == "device") {';
      // jcallbackCode += `\t${jParams[i]} = function(x) { jnode.remoteSyncExec(${jParams[i]}[0], [x], "true"); }\n`;
      // jcallbackCode += '} else if(nodeType == "fog") {'
      // jcallbackCode += `\t${jParams[i]} = function(x) { jnode.remoteSyncExec(${jParams[i]}[1], [x], "true"); }\n`;
      // jcallbackCode += '} else if(nodeType == "cloud") {' 
      // jcallbackCode += `\t${jParams[i]} = function(x) { jnode.remoteSyncExec(${jParams[i]}[2], [x], "true"); }\n`;
      // jcallbackCode += '}';
      ps.push("_" + i);
      annotated_ps.push("_" + i + ':' + types[cParams[i]].js_type);
    } else {
      ps.push(jParams[i]);
      annotated_ps.push(jParams[i] + ':' + types[cParams[i]].js_type);
    }
  }
        
  var jsout = "function call" + fname + "(" + ps.join(',') + ") {\n" + stmt + "\n}";
  var annotated_jsout = "function call" + fname + "(" + annotated_ps.join(',') + "): void {\n" + stmt + "\n}";

  return {
    JS: jsout, 
    annotated_JS: annotated_jsout
  };
}

function CreateJSASyncCFunction(fname, cParams, jParams, jCond) {
  var ps = [], qs = [], c_codes = [];

  for (var i = 0; i < cParams.length; i++) {
    ps.push(cParams[i] + ' ' + jParams[i]);
    qs.push(jParams[i]);
    c_codes.push(types[cParams[i]].c_code);
  }

  var cout = "jactivity_t *" + fname + "(" + ps.join(', ') + ") {\n";
  cout += 'jactivity_t *jact = jam_create_activity(js);\n';
  cout += `jactivity_t *res = jam_rexec_async(js, jact, "${jCond.source}", ${jCond.code}, "${fname}", "${c_codes.join('')}"`;
  if(qs.length > 0) {
    cout += ',' + qs.join(', ');
  }
  cout += ');\n';
  cout += 'activity_free(jact);\n';

  cout += 'return res;';
  cout += '}\n';

  return cout;
}

function CreateJSSyncJSFunction(rtype, fname, cParams, jParams, stmt) {
  var ps = [];
  var annotated_ps = [];
  for (var i = 0; i < cParams.length; i++) {
    ps.push(jParams[i]);
    var typeName;
    if(typeof(cParams[i]) === 'object') {
      typeName = cParams[i].type;
    } else {
      typeName = cParams[i];
    }
    annotated_ps.push(jParams[i] + ':' + types[typeName].js_type);
  }
  
  var js_return_type;
  if(rtype == "void") {
    js_return_type = "void";
  } else {
    js_return_type = types[rtype].js_type;
  }

  var jsout = "function call" + fname + "(" + ps.join(',') + ") {\n" + stmt + "\n}";
  var annotated_jsout = "function call" + fname + "(" + annotated_ps.join(',') + "):" + js_return_type + " {\n" + stmt + "\n}";

  return {
    JS: jsout, 
    annotated_JS: annotated_jsout
  };
}

function CreateJSSyncCFunction(dspec, fname, cParams, jParams, jCond) {
  var ps = [], qs = [];
  var c_codes = [];

  for (var i = 0; i < cParams.length; i++) {
    var typeName;
    if(typeof(cParams[i]) === 'object') {
      typeName = cParams[i].type;
    } else {
      typeName = cParams[i];
    }
    ps.push(typeName + ' ' + jParams[i]);
    qs.push(jParams[i]);
    c_codes.push(types[typeName].c_code);
  }

  var cout = dspec + " " + fname + "(" + ps.join(', ') + ") {\n";
  cout += `arg_t *res = jam_rexec_sync(js, "${jCond.source}", ${jCond.code}, "${fname}", "${c_codes.join('')}"`;
  if(qs.length > 0) {
    cout += ',' + qs.join(', ');
  }
  cout += ');\n';

  if(dspec == 'void') {
    cout += 'command_arg_free(res);\n'
    cout += 'return;\n';
  } else {
    var retval = 'res->val.' + types[dspec].jamlib;
    if(dspec == 'char*') {
      retval = 'strdup(' + retval + ')';
    }
    cout += dspec + ' ret = ' + retval + ';\n';
    cout += 'command_arg_free(res);\n'
    cout += 'return ret;\n';
  }
  cout += '}\n';

  return cout;
}

function CreateJSAsyncMachFunction(fname, jCond, params) {
  var jsout = "function " + fname + "(" + params.join(',') + ") {\n";

  for(var i = 0; i < params.length; i++) {
    jsout += `if(typeof ${params[i]} === "function") { ${params[i]} = ${params[i]}.name; }\n`;
  }

  jsout += `jnode.machAsyncExec("call${fname}", [ ${params.join(',')} ], "${jCond.source}", ${jCond.code});\n`;
  jsout += "}\n";
  
  return jsout;
}

function CreateJSSyncMachFunction(fname, jCond, params) {
  var jsout = "function " + fname + "(" + params.join(',') + ") {\n";
  jsout += `yield wait.for(jnode.machSyncExec("call${fname}", [ ${params.join(',')} ], "${jCond.source}", ${jCond.code}));\n`;
  jsout += "}\n";

  return jsout;
}

function isUndefined(x) { return x === void 0; }

// Take an Array of nodes, and whenever an _iter node is encountered, splice in its
// recursively-flattened children instead.
function flattenIterNodes(nodes) {
  var result = [];
  for (var i = 0; i < nodes.length; ++i) {
    if (nodes[i]._node.ctorName === '_iter') {
      result.push.apply(result, flattenIterNodes(nodes[i].children));
    } else {
      result.push(nodes[i]);
    }
  }
  return result;
}

// Comparison function for sorting nodes based on their source's start index.
function compareByInterval(node, otherNode) {
  return node.source.startIdx - otherNode.source.startIdx;
}


function parseList(list, sep) {
  if(list.child(0).ctorName == "NonemptyListOf") {
    return parseNonEmptyList(list.child(0), sep);
  } else {
    return "";
  }
}

function parseNonEmptyList(list, sep) {
  var code = list.child(0).jamCTranslator;
  var rest = list.child(2);
  for (var i = 0; i < rest.numChildren; i++) {
    code += sep + rest.child(i).jamCTranslator
  }
  return code;
}

function parseArrayList(list, sep) {
  var code = '';
  for (var i = 0; i < list.numChildren; i++) {
    code += list.child(i).jamCTranslator + sep;
  }
  return code;
}

var jamJSTranslator = {  
  Program: function(directives, elements) {
    var jsout = "";
    var cout = "";
    var annotated_JS = "";
    var hasJdata = false;
    jsout += "var jcondition = new Map();\n"
    callGraph.addFunction('js', 'root');
    currentFunction = "root";
    for (var i = 0; i < elements.children.length; i++) {
      if(elements.child(i).child(0).child(0).ctorName == "Activity_def") {
        // var output = elements.child(i).child(0).child(0).jamJSTranslator;
        // cout += output.C + '\n';
        // jsout += output.JS + '\n';
        // annotated_JS += output.annotated_JS + '\n';
        jsout += elements.child(i).child(0).child(0).jamJSTranslator;
      } else if(elements.child(i).child(0).child(0).ctorName == "Jconditional") {
        jsout += elements.child(i).child(0).child(0).jamJSTranslator;
      } else if(elements.child(i).child(0).child(0).ctorName == "Jdata_decl") { 
        hasJdata = true;
        elements.child(i).child(0).child(0).jamJSTranslator;
      } else {
        currentFunction = "root";
        jsout += elements.child(i).child(0).child(0).es5Translator + '\n';
      }    
    }
    jsout = generate_js_logger_vars() + jsout;

    var requires = '';
    requires += "var jamlib = require('/usr/local/share/jam/lib/jserver/jamlib');\n";
    requires += "var jnode = require('/usr/local/share/jam/lib/jserver/jnode');\n";

    requires += "var http = require('http');\n";
    requires += "var cbor = require('cbor');\n";
    requires += "var qs = require('querystring');\n";
    requires += "var path = require('path');\n";
    requires += "var mime = require('mime');\n";
    requires += "var fs = require('fs');\n";
    requires += "var wait = require('wait.for-es6');\n";

    if(hasJdata) {
      requires += "var JAMLogger = require('/usr/local/share/jam/lib/jserver/jamlogger');\n";
      requires += "var JAMManager = require('/usr/local/share/jam/lib/jserver/jammanager');\n";
    }
    jsout = "function* main() {\n" + jsout + "\n"; // Open main function
    annotated_JS = "function* main() {\n" + annotated_JS + "\n";// Open main function

    jsout = requires + jsout;
    annotated_JS = requires + annotated_JS;

    return {'C': cout, 'JS': jsout, 'annotated_JS': annotated_JS};
  },
  Activity_def: function(node) {
    return node.jamJSTranslator;
  },
  jdata_type: function(type) {
    return type.sourceString;
  },
  Jdata_spec_specified: function(type_spec, id, _1, jdata_type, _2, level, _3, _4) {
    return {
      name: id.sourceString,
      type_spec: type_spec.sourceString,
      jdata_type: jdata_type.jamJSTranslator
    };
  },
  Jdata_spec_default: function(type_spec, id, _1, jdata_type, _2) {
    return {
      name: id.sourceString,
      type_spec: type_spec.sourceString,
      jdata_type: jdata_type.jamJSTranslator
    };
  },
  Jdata_spec_other: function(id, _1, type, _2) {
    type.jamJSTranslator;
    return {
      name: id.sourceString,
      type_spec: "",
      jdata_type: ""
    }
  },
  Jdata_spec: function(node) {
    return node.jamJSTranslator
  },
  Window_points: function(_1, _2, size, _3, layerSpecifier, _4, id) {
    return "window[" + size.sourceString + "] " + layerSpecifier.jamJSTranslator + " of" + id.sourceString + ";"
  },
  Window_time: function(_1, time, _2, id) {
    time.jamJSTranslator;
    return "";
  },
  Transform: function(_1, layerSpecifier, sourceId, _2, destIds) {
    return "";
  },
  Iopad: function(_1, _2, ids) {
    return "";
  },
  Iopadref: function(_1, _2, id) {
    return "";
  },
  iopadref_id: function(app, _, id) {
    return "";
  },
  jdata_id_namespace: function(namespace, _, id) {
    return "";
  },
  jdata_id: function(id) {
    return "";
  },
  Absolute_time_utc: function(_1, startTime, _2, endTime) {
    var startDate = Date.parse(startTime.sourceString);
    if(isNaN(startDate)) {
      error("Invalid start date " + startTime.sourceString);
    }
    if(endTime.numChildren > 0) {
      var endDate = Date.parse(endTime.sourceString);
      if(isNaN(endDate)) {
        error("Invalid end date: " + endTime.sourceString);
      }
    }
    return "";
  },
  Absolute_time_unix: function(_1, startTime, _2, endTime) {
    return "";
  },
  Relative_time: function(_, time, unit) {
    return "";
  },
  utc_string: function(date, _, time) {
    return "";
  },
  utc_date: function(year, _1, month, _2, day) {
    return "";
  },
  utc_time_millisecond: function(hours, _1, minutes, _2, seconds, _3, milliseconds, timezone) {
    return "";
  },
  utc_time_default: function(hours, _1, minutes, _2, seconds, timezone) {
    return "";
  },
  utc_timezone_timezone: function(sign, hours, _, minutes) {
    return "";
  },
  utc_timezone: function(_) {
    return "";
  },
  Layer_specifier: function(_1, source, _2, dest, _3) {
    return {
      source: source.sourceString,
      destination: dest.sourceString
    };
  },
  Jdata_decl_named: function(_1, id, _2, jdata_spec, _3) {
    var tableEntry = {
      type: "jdata namespace",
      children: new Map()
    };
    for(var i = 0; i < jdata_spec.numChildren; i++) {
      var spec = jdata_spec.child(i).jamJSTranslator;
      tableEntry.children.set(spec.name, {
        type: "jdata", 
        type_spec: spec.type_spec,
        jdata_type: spec.jdata_type
      });
    }
    symbolTable.set(id.sourceString, tableEntry);
    return '';
  },
  Jdata_decl_anonymous: function(_1, _2, jdata_spec, _3) {
    for(var i = 0; i < jdata_spec.numChildren; i++) {
      var spec = jdata_spec.child(i).jamJSTranslator;
      symbolTable.set(spec.name, {
        type: "jdata",
        type_spec: spec.type_spec,
        jdata_type: spec.jdata_type
      });
    }
    return '';
  },
  Jcond_rule: function(left, op, right) {
    var code = 0;
    // Put sys.type on left hand side, so we don't have to check everything twice
    if(right.sourceString == "sys.type") {
      if(left.sourceString == "sys.type") {
        error("Cannot have sys.type as both sides of expression");
      } else {
        var temp = right;
        right = left;
        left = temp;
      }
    }
    if(left.sourceString == "sys.type") {
      if(op.sourceString == "==") {
        if(right.sourceString == '"dev"') {
          code = 1;
        } else if(right.sourceString == '"fog"') {
          code = 2;
        } else if(right.sourceString == '"cloud"') {
          code = 4;
        }
      } else if(op.sourceString == "!=") {
        if(right.sourceString == '"dev"') {
          code = 6;
        } else if(right.sourceString == '"fog"') {
          code = 5;
        } else if(right.sourceString == '"cloud"') {
          code = 3;
        }
      } else {
        error("Operator " + op.sourceString + " not compatible with sys.type");
      }
    } else if(left.sourceString == "sys.sync") {
      if(op.sourceString == ">=" || op.sourceString == "==") {
        if(right.child(0).ctorName == "literal" && Number(right.sourceString) > 0) {
            code = code | 8;
        }
      }
    } else if(left.child(0).ctorName != "literal" || right.child(0).ctorName != "literal") {
      code = code | 16;
    }
    return {
      string: "jcondition_context['" + left.sourceString + "'] " + op.sourceString + ' ' + escape(right.sourceString),
      code: code
    }
  },
  Jcond_entry: function(id, _1, rules, _2) {
    var first = rules.child(0).jamJSTranslator;
    var seperators = rules.child(1);
    var rest = rules.child(2);
    var code = first.code;
    var string = first.string;
    for (var i = 0; i < rest.numChildren; i++) {
      string += ' ' + seperators.child(i).sourceString + ' ' + rest.child(i).jamJSTranslator.string;
      code = code | rest.child(i).jamJSTranslator.code;
    }
    return {
      name: id.sourceString,
      string: string,
      code: code
    }
  },
  Jconditional: function(_1, id, _2, entries, _3) {
    var output = "";
    var namespace = "";
    if(id.numChildren > 0) {
      namespace = id.es5Translator + '.';
    }
    for(var i = 0; i < entries.numChildren; i++) {
      var entry = entries.child(i).jamJSTranslator;
      output += "jcondition.set('" + namespace + entry.name + "', { source: '" + entry.string + "', code: " + entry.code + " });\n";
      jConditions.set(namespace + entry.name, { source: entry.string, code: entry.code });
    }
    return output;
  },
  Sync_activity: function(_, jCond_spec, functionDeclaration) {
    var jCond = {
      source: "true",
      code: 0
    };
    if(jCond_spec.numChildren > 0) { 
      jCond = jCond_spec.jCondTranslator[0];
    }
    var specs = functionDeclaration.jamJSTranslator;
    var rtype = undefined;
    var cParams;
    var jParams = specs.params;

    symbolTable.set(specs.fname, {
      type: "activity",
      activityType: "sync",
      language: "js"
    });
    callGraph.addActivity('js', specs.fname, "sync");
    activities.set(specs.fname, {
      type: "sync",
      params: specs.params,
      jCond: jCond,
      code: specs.block.es5Translator
    });
    return CreateJSSyncMachFunction(specs.fname, jCond, specs.params);
  },
  Async_activity: function(_, jcond_spec, functionDeclaration) {
    var jCond = {
      source: "true",
      code: 0
    };
    if(jcond_spec.numChildren > 0) { 
      jCond = jcond_spec.jCondTranslator[0];
    }
    var specs = functionDeclaration.jamJSTranslator;
    symbolTable.set(specs.fname, {
      type: "activity",
      activityType: "async",
      language: "js"
    });
    callGraph.addActivity('js', specs.fname, "async");
    activities.set(specs.fname, {
      type: "async",
      name: specs.fname,
      params: specs.params,
      jCond: jCond,
      code: specs.block.es5Translator
    });
    jsActivities.set(currentFunction, {
      signature: Array(specs.params.length).fill("x"),
      jsParams: specs.params,
      block: specs.block.es5Translator
    });
    return CreateJSAsyncMachFunction(specs.fname, jCond, specs.params);
  },
  FunctionDeclaration: function(_1, id, _2, params, _3, _4, block, _5) {
    currentFunction = id.es5Translator;
    return {
      fname: id.es5Translator,
      params: params.jamJSTranslator,
      block: block
    }
  },
  FormalParameterList: function(params){
    var paramArray = [];
    if(params.child(0).ctorName == "NonemptyListOf") {
      var list = params.child(0);
      paramArray.push(list.child(0).es5Translator);
      var rest = list.child(2);
      for (var i = 0; i < rest.numChildren; i++) {
        paramArray.push(rest.child(i).es5Translator);
      }
    }
    return paramArray;
  },
  _nonterminal: function(children) {
    var flatChildren = flattenIterNodes(children).sort(compareByInterval);
    var childResults = flatChildren.map(function(n) { return n.jamJSTranslator; });
    if (flatChildren.length === 0 || childResults.every(isUndefined)) {
      return undefined;
    }
    var code = '';
    for (var i = 0; i < flatChildren.length; ++i) {
      if (childResults[i] != null) {
        code += childResults[i];
      }
    }
    return code;
  },
  _terminal: function() {
    return this.sourceString;
  },
  NonemptyListOf: function(first, sep, rest) {
    var code = first.jamJSTranslator;
    for (var i = 0; i < rest.numChildren; i++) {
      code += ' ' + sep.child(i).sourceString + ' ' + rest.child(i).jamJSTranslator;
    }
    return code;
  },

  EmptyListOf: function() {
    return "";
  }
}



var jamCTranslator = {
  Namespace_spec: function(_, namespace) {
    return namespace.sourceString;
  },
  Sync_activity: function(_, specs, jCond_spec, declarator, namespace, stmt) {
    var jCond = {
      source: "true",
      code: 0
    };
    if(jCond_spec.numChildren > 0) { 
      jCond = jCond_spec.jCondTranslator[0];
    }
    var decl = declarator.jamCTranslator;
    var funcname = decl.name;
    var currentFunction = funcname;
    symbolTable.set(funcname, {
      type: "activity",
      activityType: "sync",
      language: "c"
    });
    symbolTable.enterScope();
    callGraph.addActivity('c', currentFunction, "sync");
    var params = decl.params;
    for(var i = 0; i < params.length; i++) {
      if(params[i].type === "jcallback") {
        error("jcallback cannot be used in synchronous activity " + funcname);
      }
      symbolTable.set(params[i].name, params[i].type);
    }
    var rtype = specs.cTranslator;
    if(decl.pointer != '') {
      rtype += decl.pointer
    }
    var namespc;
    if(namespace.numChildren > 0) {
      namespc = namespace.jamCTranslator
      // funcname = namespc + "_func_" + namespace_funcs[namespc].indexOf(funcname);
    }

    var js_output = CreateCSyncJSFunction(funcname, jCond, params);
    var c_output = CreateCSyncCFunction(rtype, funcname, params, stmt.cTranslator);

    symbolTable.exitScope();

    return {
      C: c_output,
      JS: js_output.JS,
      annotated_JS: js_output.annotated_JS
    }
  },
  Async_activity: function(_, jCond_spec, decl, namespace, stmt) {
    var jCond = {
      source: "true",
      code: 0
    };
    if(jCond_spec.numChildren > 0) { 
      jCond = jCond_spec.jCondTranslator[0];
    }
    var funcname = decl.jamCTranslator.name;
    symbolTable.set(funcname, {
      type: "activity",
      activityType: "async",
      language: "c"
    });
    symbolTable.enterScope();
    currentFunction = funcname;
    callGraph.addActivity('c', currentFunction, "async");
    var params = decl.jamCTranslator.params;
    for(var i = 0; i < params.length; i++) {
      symbolTable.set(params[i].name, params[i].type);
    }
    if(namespace.numChildren > 0) {
        // funcname = namespc + "_func_" + namespace_funcs[namespc].indexOf(funcname);
    }
    var js_output = CreateCASyncJSFunction(funcname, jCond, params);
    var c_output = CreateCASyncCFunction("jactivity_t*", funcname, params, stmt.cTranslator);
    symbolTable.exitScope();

    return {
      C: c_output,
      JS: js_output.JS,
      annotated_JS: js_output.annotated_JS
    }
  },
  Activity_def: function(node) {
    return node.jamCTranslator;
  },
  Source: function(decls) {
    var cout = "";
    var jsout = "";
    var annotated_JS = "";

    for (var i = 0; i < decls.numChildren; i++) {
      // if(decls.child(i).child(0).ctorName == "Jdata_decl") {
      //   decls.child(i).child(0).jamTranslator;
      // } else 
      if(decls.child(i).child(0).ctorName == "Activity_def") {
        var output = decls.child(i).child(0).jamCTranslator;
        cout += output.C + '\n';
        jsout += output.JS + '\n';
        annotated_JS += output.annotated_JS + '\n';
      } else if(decls.child(i).child(0).ctorName == "Prototype") {
        if(decls.child(i).child(0).sourceString == "int main();") { 
          cout = "";
          jsout = "";
          annotated_JS = "";
          callGraph.resetCallGraph('c');
        } else {
          cout += decls.child(i).child(0).jamCTranslator + '\n';
        }
      } else {
        cout += decls.child(i).child(0).cTranslator + '\n';
      }
    }

    callGraph.pruneJSCallGraph();
    callGraph.checkCalls();

    // cout += generate_c_async_signatures(input.data.cCallbacks);
    cout = generate_c_broadcaster_vars() + cout;
    cout = generate_c_shuffler_vars() + cout;
    cout += generate_c_activity_wrappers();
    cout += generate_setup();
    cout += generate_jam_run_app();
    cout += generate_taskmain();
    cout = 'jamstate_t *js;\n' + cout;
    cout = 'typedef char* jcallback;\n' + cout;
    cout = 'char jdata_buffer[20];\n' + cout;
    cout = 'char app_id[256] = { 0 };\n' + cout;

    var output = generateJSActivities();
    jsout += output.JS;
    annotated_JS += output.annotated_JS;

    jsout += generate_js_mbox();
    annotated_JS += generate_js_mbox();

    // annotated_JS = "/* @flow */\n" + struct_objects + annotated_JS + this.generate_js_signatures();

    return {'C': cout, 'JS': jsout, 'annotated_JS': annotated_JS};
  },
  Prototype: function(specs, pointer, id, _1, params, _2, gcc, _3) {
    var rtype = specs.cTranslator;
    if(pointer.numChildren > 0) {
      rtype += pointer.cTranslator;
    }
    var parameters = [];
    if(params.numChildren > 0) {
      parameters = params.jamCTranslator[0];
    }
    prototypes.set(id.cTranslator, {
      return_type: rtype,
      params: parameters
    });

    var c_output = "";

    if(activities.has(id.cTranslator)) {
      var activity = activities.get(id.cTranslator);
      var jParams = activity.params;
      var block = activity.code;
      var jCond = activity.jCond;

      var js_codes = [];
      for(var i = 0; i < parameters.length; i++) {
        js_codes.push(types[parameters[i]].js_code);
      }

      if(activity.type == "sync") {
        // Sync
        for(var i = 0; i < parameters.length; i++) {
          if(parameters[i] === "jcallback") {
            error("jcallback cannot be used in synchronous activity " + id.cTranslator);
          }
        }
        c_output = CreateJSSyncCFunction(rtype, id.cTranslator, parameters, jParams, jCond);

        jsActivities.set(id.cTranslator, {
          type: "sync",
          signature: js_codes,
          returnType: rtype, 
          cParams: parameters,
          jsParams: jParams, 
          block: block
        });
      } else {
        // Async
        c_output = CreateJSASyncCFunction(id.cTranslator, parameters, jParams, jCond);

        jsActivities.set(id.cTranslator, {
          type: "sync",
          signature: js_codes,
          returnType: rtype, 
          cParams: parameters,
          jsParams: jParams, 
          block: block
        });
      }
    } else {
      c_output = this.cTranslator;
    }
    return c_output;
  },
  Pcall_decl: function(node) {
    return node.jamCTranslator;
  },
  Pcall_decl_ParamTypeList: function(_1, node, _2) {
    return node.jamCTranslator;
  },
  Pcall_decl_Empty: function(_1, _2) {
    return [];
  },
  Param_type_lst: function(param_list) {
    var params = []
    params.push(param_list.child(0).jamCTranslator);
    // console.log(params);
    var rest = param_list.child(2);
    for (var i = 0; i < rest.numChildren; i++) {
      params.push(rest.child(i).jamCTranslator);
    }
    return params;
  },
  Declarator: function(pointer, dir_declarator, _1, _2) {
    var dir_decl = dir_declarator.jamCTranslator;
    return {
      pointer: pointer.cTranslator,
      name: dir_decl.name,
      params: dir_decl.params
    }
  },
  Dir_declarator_PCall: function(name, params) {
    return {
      name: name.cTranslator,
      params: params.jamCTranslator
    };
  },
  Dir_declarator_Id: function(id) {
    return {
      name: id.cTranslator
    }
  },
  Dir_declarator: function(node) {
    return node.jamCTranslator;
  },
  Param_decl: function(node) {
    return node.jamCTranslator;
  },
  Param_decl_Declarator: function(decl_specs, decl) {
    var varType = decl_specs.cTranslator;
    if(decl.jamCTranslator.pointer != '') {
      varType += decl.jamCTranslator.pointer
    }
    return {
      type: varType,
      name: decl.jamCTranslator.name 
    };
  },
  _nonterminal: function(children) {
    var flatChildren = flattenIterNodes(children).sort(compareByInterval);
    var childResults = flatChildren.map(function(n) { return n.jamCTranslator; });
    if (flatChildren.length === 0 || childResults.every(isUndefined)) {
      return undefined;
    }
    var code = '';
    for (var i = 0; i < flatChildren.length; ++i) {
      if (childResults[i] != null) {
        code += childResults[i];
      }
    }
    return code;
  },
  _terminal: function() {
    return this.primitiveValue;
  },
  NonemptyListOf: function(first, sep, rest) {
    var code = first.jamCTranslator;
    for (var i = 0; i < rest.numChildren; i++) {
      code += sep.child(i).primitiveValue + ' ' + rest.child(i).jamCTranslator;
    }
    return code;
  },

  EmptyListOf: function() {
    return "";
  }
};
var jCondTranslator = {
  Jcond_expr_paran: function(_1, expr, _2) {
    return {
      source: "(" + expr.jCondTranslator.source + ")",
      code: expr.jCondTranslator.code
    }
  },
  Jcond_expr_not: function(_, expr) {
    return {
      source: "!" + expr.jCondTranslator.source,
      code: expr.jCondTranslator.code ^ 31
    }
  },
  Jcond_expr_bin_op: function(expr1, op, expr2) {
    return {
      source: expr1.jCondTranslator.source + " " + op.sourceString + " " + expr2.jCondTranslator.source,
      code: expr1.jCondTranslator.code | expr2.jCondTranslator.code
    };
  },
  Jcond_expr: function(node) {
    return node.jCondTranslator;
  },
  Jcond_expr_namespace_id: function(namespace, _, id) {
    return {
      source: `jcondition.get('${namespace.sourceString}.${id.sourceString}').source`,
      code: jConditions.get(namespace.sourceString + '.' + id.sourceString).code
    }
  },
  Jcond_expr_id: function(id) {
    return { 
      source: `jcondition.get('${id.sourceString}').source`,
      code: jConditions.get(id.sourceString).code
    };
  },
  Jcond_specifier: function(_1, jconds, _2) {
    return jconds.jCondTranslator;
  }
};
// cTranslator.Assign_expr_assign = function(left, op, right) {
//   var symbol = symbolTable.get(left.cTranslator);
//   if(symbol !== undefined) {
//     if(symbol.jdata_type == "broadcaster" ) {
//         error('Cannot save to broadcaster ' + left.cTranslator);
//     } else if(symbol.jdata_type == "logger") {
//       console.log(`jdata_log_to_server(${left.cTranslator}, "${right.cTranslator}", NULL)`);
//       return `jdata_log_to_server(${left.cTranslator}, "${right.cTranslator}", NULL)`; 
//     }
//   }
//   return left.cTranslator + ' ' + op.sourceString + ' ' + right.cTranslator;
// }

cTranslator.Dir_declarator_Id = function(id) {
  var symbol = symbolTable.get(id.sourceString);
  if(symbol !== undefined) {
    if(symbol.jdata_type == "broadcaster" ) {
        error('Cannot declare broadcaster ' + id.sourceString);
    }
  }
  return id.sourceString;
}

// cTranslator.Dir_declarator_PCall = function(name, params) {
//   console.log(name.cTranslator);
//   return name.cTranslator + params.cTranslator;
// }

cTranslator.Left_expr_Call = function(left, params) {
  var paramString;
  var cout = "";

  if(prototypes.has(left.cTranslator)) {
    var paramArray = [];
    var prototypeParams = prototypes.get(left.cTranslator).params;
    for (var i = 0; i < prototypeParams.length; i++) {
      if(prototypeParams[i] == "jcallback") {
        var jcallbackName = params.child(1).asIteration().child(i).sourceString;
        cActivities.set(jcallbackName, {
          codes: ["s"],
          type: "async"
        });
        cCallbackActivities.add(jcallbackName);
        paramArray.push('"' + jcallbackName + '"');
      } else {
        paramArray.push(params.child(1).asIteration().child(i).sourceString);
      }
    }
    paramString = '(' + paramArray.join(', ') + ')';
  } else if(symbolTable.has(left.cTranslator) && symbolTable.get(left.cTranslator) == "jcallback") {
      var cout = 'jactivity_t *jact = jam_create_activity(js);\n';
      cout += 'jactivity_t *res = jam_rexec_async(js, jact, "true", 0, ' + left.cTranslator 
        + ', "%s", ' + params.cTranslator.substring(1, params.cTranslator.length - 1) + ');\n';
      cout += 'activity_free(jact);\n';
      return cout;
  } else {
    paramString = params.cTranslator;
  }
  var res = symbolTable.get(left.cTranslator);
  if(res !== undefined && (res == "function" || res.type == "activity")) {
    callGraph.addCall('c', currentFunction, left.cTranslator, params.cTranslator);
  }
  return left.cTranslator + paramString;
}

cTranslator.Primary_expr = function(node) {
  if(node.ctorName == "id") {
    var symbol = symbolTable.get(node.sourceString);
    if(symbol !== undefined && symbol.type == "jdata") {
      if(symbol.jdata_type == "logger" 
        || symbol.jdata_type == "shuffler") {
          error('Cannot read values from ' + symbol.jdata_type + ' ' + node.sourceString);
      } else if(symbol.jdata_type == "broadcaster") {
        return `${types[symbol.type_spec].caster}(get_jbroadcaster_value(${node.sourceString}))`
      } else if(symbol.jdata_type == "shuffler") {
        return `(char *)jshuffler_poll(${node.sourceString});`
      }
    }
  }
  return node.cTranslator;
}

function createJdataCall(namespace, id, value, type, spec) {
  if(type == "broadcaster" ) {
    error('Cannot declare broadcaster ' + id);
  } else if(type == "logger") {
    if(spec == "char") {
      return `jamdata_log_to_server("${namespace}", "${id}", ${value}, ((void*)0));`; 
    } else {
      var cout = `sprintf(jdata_buffer, "${types[spec].c_pattern}", ${value});\n`;
      cout += `jamdata_log_to_server("${namespace}", "${id}", jdata_buffer, ((void*)0));`;
      return cout;
    }
  } else if(type == "shuffler") {
    return `jshuffler_push(${id}, ${value});`; 
  }
}

cTranslator.Assign_stmt_named = function(namespace, _1, id, _2, expr, _3) {
  var symbol = symbolTable.get(namespace.sourceString);
  if(symbol !== undefined && symbol.type == "jdata namespace") {
    if(symbol.children.has(id.sourceString)) {
      var child = symbol.children.get(id.sourceString);
      return createJdataCall(namespace.sourceString, id.sourceString, expr.cTranslator, child.jdata_type, child.type_spec);
    }
  }
  return namespace.sourceString + '.' + id.sourceString + ' = ' + expr.cTranslator + ';';
}

cTranslator.Assign_stmt_anonymous = function(id, _1, expr, _2) {
  var symbol = symbolTable.get(id.sourceString);
  if(symbol !== undefined && symbol.type === "jdata") {
    return createJdataCall("global", id.sourceString, expr.cTranslator, symbol.jdata_type, symbol.type_spec);
  }
  return id.sourceString + ' = ' + expr.cTranslator + ';';
}

cTranslator.Function_def = function(specs, decl, stmts) {
    var declaration = '';
    var fname = '';
    var params = [];
    if(decl.cTranslator == "main()") {
      declaration = 'user_main()';
      fname = "user_main";
    } else {
      // Get function params
      fname = decl.child(1).child(0).child(0).cTranslator;
      params = decl.child(1).child(0).child(1).child(0).child(1).cTranslator.split(', ');
      declaration = decl.cTranslator;
    }
    symbolTable.set(fname, "function");
    currentFunction = fname;
    callGraph.addFunction('c', fname);
    symbolTable.enterScope();
    params.forEach(function(param) {
        var index = param.lastIndexOf(' ');
        symbolTable.set(param.substring(index+1), param.substring(0, index));
      }, this);
    var cout = specs.cTranslator + " " + declaration + " " + stmts.cTranslator;
    symbolTable.exitScope();
    return cout;
  },


es5Translator.AssignmentStatement = function(namespace, _1, left, _2, right) {
  var symbol;
  var leftSide;
  if(namespace.numChildren > 0) {
    leftSide = namespace.es5Translator + '.' + left.es5Translator;
    symbol = symbolTable.get(namespace.es5Translator[0]).children.get(left.es5Translator);
  } else {
    leftSide = left.es5Translator;
    symbol = symbolTable.get(left.es5Translator);
  }
  if(symbol !== undefined) {
    if(symbol.jdata_type == "broadcaster" ) {
      var value;
      // Convert value to a string
      if(symbol.type_spec == "char*") {
        value = `String(${right.es5Translator})`;
      } else {
        value = `String(Number(${right.es5Translator}))`;
      }
      return `JAMManager.broadcastMessage("${leftSide}", ${value});`;
    } else if(symbol.jdata_type == "logger") {
        error(`Cannot write to logger var ${sideSide} from javascript`);
    }
  }
  return leftSide + ' = ' + right.es5Translator + ';';
}

es5Translator.CallExpression_memberExpExp = function(exp, args) {
  callGraph.addCall('js', currentFunction, exp.es5Translator, args.es5Translator);
  return exp.es5Translator + args.es5Translator;
}

es5Translator.CallExpression_callExpExp = function(exp, args) {
  callGraph.addCall('js', currentFunction, exp.es5Translator, args.es5Translator);
  return exp.es5Translator + args.es5Translator;
}

es5Translator.FunctionDeclaration = function(_1, id , _2, params, _3, _4, body, _5) {
  var currentFunction = id.es5Translator;
  if(params.jamJSTranslator.length == 1) {
    jsActivities.set(currentFunction, {
      type: "callback",
      signature: ["x"],
      jsParams: params,
      block: body.es5Translator
    });
  }
  jsFunctions.add(currentFunction);
  callGraph.addFunction('js', currentFunction);
  return `function ${id.es5Translator}(${params.es5Translator}) {\n${body.es5Translator}}`;
}
es5Translator.FunctionExpression_named = function(_1, id , _2, params, _3, _4, body, _5) {
  currentFunction = id.es5Translator;
  jsFunctions.add(currentFunction);
  callGraph.addFunction('js', currentFunction);
  return `function ${id.es5Translator}(${params.es5Translator}) {\n${body.es5Translator}}`;
}
es5Translator.FunctionExpression_anonymous = function(_1, _2, params, _3, _4, body, _5) {
  currentFunction = "anonymous";
  jsFunctions.add(currentFunction);
  callGraph.addFunction('js', currentFunction);
  return `function (${params.es5Translator}) {\n${body.es5Translator}}`;
}

// Instantiate the JAMScript grammar.
var jamc = fs.readFileSync(path.join(__dirname, 'jamc.ohm'));
var jamjs = fs.readFileSync(path.join(__dirname, 'jamjs.ohm'));
var ns = {};
ns.C = ohm.grammar(fs.readFileSync(path.join(__dirname, '../c/c.ohm')));
ns.ES5 = ohm.grammar(fs.readFileSync(path.join(__dirname, '../ecmascript/es5.ohm')));
var jamCGrammar = ohm.grammar(jamc, ns);
var jamJSGrammar = ohm.grammar(jamjs, ns);
var cSemantics = jamCGrammar.createSemantics();
var jsSemantics = jamJSGrammar.createSemantics();

cSemantics.addAttribute('jamCTranslator', jamCTranslator);
cSemantics.addAttribute('cTranslator', cTranslator);
cSemantics.addAttribute('jCondTranslator', jCondTranslator);
jsSemantics.addAttribute('jamJSTranslator', jamJSTranslator);
jsSemantics.addAttribute('es5Translator', es5Translator);
jsSemantics.addAttribute('jCondTranslator', jCondTranslator);

module.exports = {
  jamJSGrammar: jamJSGrammar,
  jamCGrammar: jamCGrammar,
  cSemantics: cSemantics,
  jsSemantics: jsSemantics,
  callGraph: callGraph
};
