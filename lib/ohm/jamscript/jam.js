/* eslint-env node */

'use strict';

// --------------------------------------------------------------------
// Imports
// --------------------------------------------------------------------

var fs = require('fs');
var path = require('path');

var ohm = require('ohm-js');
var cTranslator = require('../c/c').cTranslator;
// var cSymbolTable = require('../c/c').cSymbolTable;
var es5Translator = require('../ecmascript/es5').es5Translator;

// --------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------
var ActivityID         = 0;
var callbacks          = {
                            c:  {
                                  async: [],
                                  sync:  []
                                },
                            js: {
                                  async: [],
                                  sync:  []
                                }
                         };
var typedefs           = [];
var namespace_funcs    = [];

var callGraph          = {
                            c: new Map(),
                            js: new Map()
                         };
var currentFunction    = "";
var jsFunctions        = new Set();
var jsActivities       = new Set();

// var activities         = {
//                             c:  {
//                                   async: [],
//                                   sync:  []
//                                 },
//                             js: {
//                                   async: [],
//                                   sync:  []
//                                 }
//                          };
var activities = new Map();
var prototypes        = new Map();
var types = {
              'int': {
                  c_pattern: '%i',
                  jamlib: 'ival',
                  js_type: 'number',
                  c_code: 'i',
                  js_code: 'n'
              },
              'float': {
                  c_pattern: '%f',
                  jamlib: 'dval',
                  js_type: 'number',
                  c_code: 'f',
                  js_code: 'n'
              },
              'char*': {
                  c_pattern: '\\"%s\\"',
                  jamlib: 'sval',
                  js_type: 'string',
                  c_code: 's',
                  js_code: 's'
              },
              'jcallback': {
                  c_pattern: '\\"%s\\"',
                  jamlib: 'sval',
                  js_type: 'string',
                  c_code: 's',
                  js_code: 's'
              }
            };

function error(node, message) {
  throw message;
}

// function generate_c_async_callbacks(callbackFuncs) {
//   var cout = '';

//   callbackFuncs.forEach(function(value, key) {
//     var c_codes = [];
//     cout += 'void call' + key + '(void *act, void *arg) {\n';
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
    
//     callbacks.c.sync.push([key, undefined, c_codes]);
//   });
//   return cout;
// }

function generate_js_logger_vars() {
  var jsout = '';
  var globals = symbolTable.getGlobals();
  globals.forEach(function(value, key, map) {
    if(value.type == 'jdata' && value.other.jdata_type == 'logger') {
      jsout += `var ${key} = new JLogger("${key}", false, JManager);\n`;
    }
  });
  return jsout;
}

function generate_c_broadcaster_vars() {
  var cout = '';
  var globals = symbolTable.getGlobals();
  globals.forEach(function(value, key, map) {
    if(value.type == 'jdata' && value.other.jdata_type == 'broadcaster') {
      cout += `jbroadcaster *${key};\n`;
    }
  });
  return cout;
}

function generate_c_shuffler_vars() {
  var cout = '';
  var globals = symbolTable.getGlobals();
  globals.forEach(function(value, key, map) {
    if(value.type == 'jdata' && value.other.jdata_type == 'shuffler') {
      cout += `jshuffler *${key};\n`;
    }
  });
  return cout;
}

function generate_js_callbacks() {
  var jsout = 'var mbox = {\n';
  jsout += '"functions": {\n';
  for (var i = 0; i < callbacks.js.sync.length; i++) {
    var callback = callbacks.js.sync[i];
    jsout += `"${callback[0]}": ${callback[0]},\n`;
  }
  for (var i = 0; i < callbacks.js.async.length; i++) {
    var callback = callbacks.js.async[i];
    jsout += `"${callback[0]}": ${callback[0]},\n`;
  }
  jsout += '},\n';
  jsout += '"signatures": {\n';
  for (var i = 0; i < callbacks.js.sync.length; i++) {
    var callback = callbacks.js.sync[i];
    jsout += `"${callback[0]}": "${callback[1].join('')}",\n`;
  }
  for (var i = 0; i < callbacks.js.async.length; i++) {
    var callback = callbacks.js.async[i];
    jsout += `"${callback[0]}": "${callback[1].join('')}",\n`;
  }
  jsout += '}\n';
  jsout += '}\n';
  
  jsout += 'jamlib.registerFuncs(mbox);\n';
  jsout += 'jamlib.run(function() { console.log("Running..."); } );\n';

  return jsout;
}

function generate_c_activities() {
  var cout = '';
  for (var i = 0; i < callbacks.c.sync.length; i++) {
    var callback = callbacks.c.sync[i];
    cout += 'activity_regcallback(js->atable, "' + callback[0] + '", SYNC, "' + callback[2].join('') + '", call' + callback[0] + ');\n';
  }
  for (var i = 0; i < callbacks.c.async.length; i++) {
    var callback = callbacks.c.async[i];
    cout += 'activity_regcallback(js->atable, "' + callback[0] + '", ASYNC, "' + callback[2].join('') + '", call' + callback[0] + ');\n';
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
    if(value.type == 'jdata' && value.other.jdata_type == 'broadcaster') {
      cout += `${key} = jbroadcaster_init(JBROADCAST_STRING, "${key}", NULL);\n`;
    }
  });
  return cout;
}

function linkJShufflerVars() {
  var cout = '';
  var globals = symbolTable.getGlobals();
  globals.forEach(function(value, key, map) {
    if(value.type == 'jdata' && value.other.jdata_type == 'jshuffler') {
      cout += `${key} = jshuffler_init(JBROADCAST_STRING, "${key}", NULL);\n`;
    }
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
    js = jam_init(1883);
    user_setup();
     
    taskcreate(jam_event_loop, js, 50000);
    taskcreate(jam_run_app, js, 50000);
  }\n`;
  return cout;
}

function CreateCASyncJSFunction(fname, params) {
  var ps = [];
  params.forEach(function(p) {
    ps.push(p.name);
  });
  var funccode = "function " + fname + "(" + ps.join(',') + ") {";

  // write the code that would call the remote function
  funccode += 'jnode.remoteAsyncExec("' + fname + '", [' + ps.join(',') + '], "true");';

  // write the end of the function
  funccode += "}";

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
  
  callbacks.c.async.push([fname, undefined, c_codes]);
  return cout;
}

function CreateCSyncJSFunction(fname, params) {
  var ps = [];
  params.forEach(function(p) {
    ps.push(p.name);
  });

  var funccode = fname + " = " + "async(function(" + ps.join(',') + ") {\n";

  // write the code that would call the remote function
  funccode += 'await (jnode.remoteSyncExec("' + fname + '", [' + ps.join(',') + '], "true"));\n';

  // write the end of the function
  funccode += "});\n";

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
    cout += 'activity_complete(js->atable, "' + types[dspec].c_code + '", ' + funcCall + ');\n';
  } else {
    cout += funcCall + ';\n';
    cout += 'activity_complete(js->atable, "");\n';
  }
  cout += '}\n';

  callbacks.c.sync.push([fname, undefined, c_codes]);
  return cout;
}

function CreateJSASyncJSFunction(fname, cParams, jParams, stmt) {
  var ps = [];
  var annotated_ps = [];
  var js_codes = [];

  for (var i = 0; i < cParams.length; i++) {
    if(cParams[i] == "jcallback") {
      stmt = `${jParams[i]} = function(x) { jnode.remoteSyncExec(${jParams[i]}, [x], "true"); }\n` + stmt;
      var jcallbackCode = "";
      // jcallbackCode += 'if(nodeType == "device") {';
      // jcallbackCode += `\t${jParams[i]} = function(x) { jnode.remoteSyncExec(${jParams[i]}[0], [x], "true"); }\n`;
      // jcallbackCode += '} else if(nodeType == "fog") {'
      // jcallbackCode += `\t${jParams[i]} = function(x) { jnode.remoteSyncExec(${jParams[i]}[1], [x], "true"); }\n`;
      // jcallbackCode += '} else if(nodeType == "cloud") {' 
      // jcallbackCode += `\t${jParams[i]} = function(x) { jnode.remoteSyncExec(${jParams[i]}[2], [x], "true"); }\n`;
      // jcallbackCode += '}';
    }
    ps.push(jParams[i]);
    annotated_ps.push(jParams[i] + ':' + types[cParams[i]].js_type);
    js_codes.push(types[cParams[i]].js_code);
  }
        
  var jsout = "function " + fname + "(" + ps.join(',') + ") {\n" + stmt + "\n}";
  var annotated_jsout = "function " + fname + "(" + annotated_ps.join(',') + "): void {\n" + stmt + "\n}";

  callbacks.js.async.push([fname, js_codes, undefined]);
  return {
    JS: jsout, 
    annotated_JS: annotated_jsout
  };
}

function CreateJSASyncCFunction(fname, cParams, jParams) {
  var ps = [], qs = [], c_codes = [];

  for (var i = 0; i < cParams.length; i++) {
    ps.push(cParams[i] + ' ' + jParams[i]);
    qs.push(jParams[i]);
    c_codes.push(types[cParams[i]].c_code);
  }


  var cout = "jactivity_t *" + fname + "(" + ps.join(', ') + ") {\n";
  cout += 'jactivity_t *jact = jam_create_activity(js);\n';
  cout += 'jactivity_t *res = jam_rexec_async(js, jact, "' + fname + '", "' + c_codes.join('') + '"';
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
  var js_codes = [];
  for (var i = 0; i < cParams.length; i++) {
    ps.push(jParams[i]);
    annotated_ps.push(jParams[i] + ':' + types[cParams[i]].js_type);
    js_codes.push(types[cParams[i]].js_code);
  }
  
  var js_return_type;
  if(rtype == "void") {
    js_return_type = "void";
  } else {
    js_return_type = types[rtype].js_type;
  }

  var jsout = "function " + fname + "(" + ps.join(',') + ") {\n" + stmt + "\n}";
  var annotated_jsout = "function " + fname + "(" + annotated_ps.join(',') + "):" + js_return_type + " {\n" + stmt + "\n}";

  callbacks.js.sync.push([fname, js_codes, undefined]);
  return {
    JS: jsout, 
    annotated_JS: annotated_jsout
  };
}

function CreateJSSyncCFunction(dspec, fname, cParams, jParams) {
  var ps = [], qs = [];
  var c_codes = [];

  for (var i = 0; i < cParams.length; i++) {
    ps.push(cParams[i] + ' ' + jParams[i]);
    qs.push(jParams[i]);
    c_codes.push(types[cParams[i]].c_code);
  }

  var cout = dspec + " " + fname + "(" + ps.join(', ') + ") {\n";
  cout += 'arg_t *res = jam_rexec_sync(js, "' + fname + '", "' + c_codes.join('') + '"';
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

var symbolTable = {
    table    : [new Map()],
    enterScope : function() {
       this.table.push(new Map());
    },
    exitScope : function() {
       this.table.pop();
    },
    has: function(name) {
      for (var i = this.table.length - 1; i >= 0; i--) {
        if(this.table.has(name)) {
          return true;
        }
      }
      return false;
    },
    get: function(name) {
      for (var i = this.table.length - 1; i >= 0; i--) {
        var entry = this.table[i].get(name);
        if(entry !== undefined) {
          return entry;
        }
      }
      return undefined; 
    },
    set: function(name, value) {
      this.table[this.table.length - 1].set(name, value);
    },
    getGlobals: function() {
      return this.table[0];
    }
};

function pruneJSCallGraph() {
  callGraph.js.forEach(function(calls, func, map) {
    for (let call of calls) {
      if(!(jsFunctions.has(call) || jsActivities.has(call))) {
        calls.delete(call);
      }
    }
  });
}

var jamJSTranslator = {  
  Program: function(directives, elements) {
    var jsout = "";
    var cout = "";
    var annotated_JS = "";
    jsout += "var jcondition = new Map();\n"
    callGraph.js.set("root", new Set());
    currentFunction = "root";
    for (var i = 0; i < elements.children.length; i++) {
      if(elements.child(i).child(0).child(0).ctorName == "Activity_def") {
        // var output = elements.child(i).child(0).child(0).jamJSTranslator;
        // cout += output.C + '\n';
        // jsout += output.JS + '\n';
        // annotated_JS += output.annotated_JS + '\n';
        elements.child(i).child(0).child(0).jamJSTranslator;
      } else if(elements.child(i).child(0).child(0).ctorName == "Jconditional") {
        jsout += elements.child(i).child(0).child(0).jamJSTranslator;
      } else if(elements.child(i).child(0).child(0).ctorName == "Jdata_decl") { 
        elements.child(i).child(0).child(0).jamJSTranslator;
      } else {
        jsout += elements.child(i).child(0).child(0).es5Translator + '\n';
      }    
    }

    jsout = generate_js_logger_vars() + jsout;

    pruneJSCallGraph();

    return {'C': cout, 'JS': jsout, 'annotated_JS': annotated_JS};
  },
  Activity_def: function(node) {
    return node.jamJSTranslator;
  },
  jdata_type: function(type) {
    return type.sourceString;
  },
  Jdata_spec: function(type_spec, id, _1, jdata_type, _2) {
    symbolTable.set(id.sourceString, {
      type: "jdata",
      other: {
        type_spec: type_spec.sourceString,
        jdata_type: jdata_type.jamJSTranslator
      }
    });
  },
  Jdata_decl: function(_1, _2, jdata_spec, _3) {
    jdata_spec.jamJSTranslator;
    return '';
  },
  Jcond_rule: function(id, op, num, _) {
    return 'jcondition_context["' + id.sourceString + '"] ' + op.sourceString + ' ' + num.es5Translator;
  },
  Jcond_entry: function(type, _1, rules, _2) {
    var code = rules.child(0).jamJSTranslator;
    for (var i = 1; i < rules.numChildren; i++) {
      code += ' && ' + rules.child(i).jamJSTranslator;
    }
    return code;
  },
  Jconditional: function(_1, id, _2, entries, _3) {
    return "jcondition.set('" + id.es5Translator + "', '" + entries.jamJSTranslator + "');";
  },
  Jcond_expr_paran: function(_1, expr, _2) {
    return "(" + expr.jamJSTranslator + ")";
  },
  Jcond_expr_not: function(_, expr) {
    return "!" + expr.jamJSTranslator;
  },
  Jcond_expr_bin_op: function(expr1, op, expr2) {
    return expr1.jamJSTranslator + " " + op.sourceString + " " + expr2.jamJSTranslator;
  },
  Jcond_expr_id: function(id) {
    return `eval(jcondition.get(${id.sourceString}))`;
  },
  Jcond_specifier: function(_1, jconds, _2) {
    var jsout = '';

    jsout += 'var jcondition_context = jnode.get_jcond();\n'
    jsout += 'if(!(' + jconds.jamJSTranslator + ')){\n'
    jsout += 'console.log(jnode.jcond_failure);\n';
    jsout += 'jnode.jcond_failure;\n';
    jsout += '}\n'; 

    return jsout;
  },
  Sync_activity: function(_, jcond_spec, functionDeclaration) {
    var jcond = "";
    if(jcond_spec.numChildren > 0) { 
      jcond = jcond_spec.jamJSTranslator;
    }
    var specs = functionDeclaration.jamJSTranslator;
    var rtype = undefined;
    var cParams;
    var jParams = specs.params;
    // if(prototypes.has(specs.fname)) {
    //   rtype = prototypes.get(specs.fname).return_type;
    //   cParams = prototypes.get(specs.fname).params;
    // }
    
    currentFunction = specs.fname;
    jsActivities.add(currentFunction);
    symbolTable.set(specs.fname, "activity");
    activities.set(specs.fname, {
      type: "sync",
      params: specs.params,
      jcond: jcond,
      code: specs.block
    });
    
    // var js_output = CreateJSSyncJSFunction(rtype, specs.fname, cParams, jParams, jcond + specs.block);
    // var c_output = CreateJSSyncCFunction(rtype, specs.fname, cParams, jParams);
    // return {
    //   C: c_output,
    //   JS: js_output.JS,
    //   annotated_JS: js_output.annotated_JS
    // }
  },
  Async_activity: function(_, jcond_spec, functionDeclaration) {
    var jcond = "";
    if(jcond_spec.numChildren > 0) { 
      jcond = jcond_spec.jamJSTranslator;
    }
    var specs = functionDeclaration.jamJSTranslator;
    currentFunction = specs.fname;
    jsActivities.add(currentFunction);
    symbolTable.set(specs.fname, "activity");
    activities.set(specs.fname, {
      type: "async",
      name: specs.fname,
      params: specs.params,
      jcond: jcond,
      code: specs.block
    });

    // var cParams;
    // var jParams = specs.params;
    // if(prototypes.has(specs.fname)) {
    //   cParams = prototypes.get(specs.fname).params;
    // }

    // var js_output = CreateJSASyncJSFunction(specs.fname, cParams, jParams, jcond + specs.block);
    // var c_output = CreateJSASyncCFunction(specs.fname, cParams, jParams);
    // return {
    //   C: c_output,
    //   JS: js_output.JS,
    //   annotated_JS: js_output.annotated_JS
    // }
  },
  FunctionDeclaration: function(_1, id, _2, params, _3, _4, block, _5) {
    return {
      fname: id.es5Translator,
      params: params.jamJSTranslator,
      block: block.es5Translator
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
    return this.primitiveValue;
  },
  NonemptyListOf: function(first, sep, rest) {
    var code = first.jamJSTranslator;
    for (var i = 0; i < rest.numChildren; i++) {
      code += sep.child(i).primitiveValue + ' ' + rest.child(i).jamJSTranslator;
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
  Sync_activity: function(_, specs, decl, namespace, stmt) {
    var decl = declarator.jamCTranslator;
    var funcname = decl.name;
    var params = decl.params;
    var rtype = specs.cTranslator;
    if(decl.pointer != '') {
      rtype += decl.pointer
    }
    var namespc;
    if(namespace.numChildren > 0) {
      namespc = namespace.jamCTranslator
      // funcname = namespc + "_func_" + namespace_funcs[namespc].indexOf(funcname);
    }

    var js_output = CreateCSyncJSFunction(funcname, params);
    var c_output = CreateCSyncCFunction(rtype, funcname, params, stmt.cTranslator);
    return {
      C: c_output,
      JS: js_output.JS,
      annotated_JS: js_output.annotated_JS
    }
  },
  Async_activity: function(_, decl, namespace, stmt) {
    var funcname = decl.jamCTranslator.name;
    var params   = decl.jamCTranslator.params;
    if(namespace.numChildren > 0) {
        // funcname = namespc + "_func_" + namespace_funcs[namespc].indexOf(funcname);
    }

    var js_output = CreateCASyncJSFunction(funcname, params);
    var c_output = CreateCASyncCFunction("jactivity_t*", funcname, params, stmt.cTranslator);
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
          callGraph.c = new Map();
          // callGraph.js = new Map();
        } else {
          var output = decls.child(i).child(0).jamCTranslator;
          cout += output.C + '\n';
          jsout += output.JS + '\n';
          annotated_JS += output.annotated_JS + '\n';
        }
      } else {
        cout += decls.child(i).child(0).cTranslator + '\n';
      }
    }
    
    // cout += generate_c_async_callbacks(input.data.cCallbacks);
    cout = generate_c_broadcaster_vars() + cout;
    cout = generate_c_shuffler_vars() + cout;
    cout += generate_setup();
    cout += generate_jam_run_app();
    cout += generate_taskmain();
    cout = 'jamstate_t *js;\n' + cout;
    cout = 'typedef char* jcallback;\n' + cout;
    
    jsout += generate_js_callbacks();
    annotated_JS += generate_js_callbacks();

    // annotated_JS = "/* @flow */\n" + struct_objects + annotated_JS + this.generate_js_callbacks();

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
    // prototypes.set(id.cTranslator, {
    //   return_type: rtype,
    //   params: parameters
    // });
    var js_output = {
      JS: "",
      annotated_JS: ""  
    };
    var c_output = "";

    if(activities.has(id.cTranslator)) {
      var activity = activities.get(id.cTranslator);
      var jParams = activity.params;
      var jCond = activity.jcond;
      var block = activity.code;
      if(activity.type == "sync") {
        // Sync
        js_output = CreateJSSyncJSFunction(rtype, id.cTranslator, parameters, jParams, jCond + block);
        c_output = CreateJSSyncCFunction(rtype, id.cTranslator, parameters, jParams);
      } else {
        // Async
        js_output = CreateJSASyncJSFunction(id.cTranslator, parameters, jParams, jCond + block);
        c_output = CreateJSASyncCFunction(id.cTranslator, parameters, jParams);
      }
    } else {
      c_output = this.cTranslator;
    }
    return {
      C: c_output,
      JS: js_output.JS,
      annotated_JS: js_output.annotated_JS
    }
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
}

// cTranslator.Assign_expr_assign = function(left, op, right) {
//   var symbol = symbolTable.get(left.cTranslator);
//   if(symbol !== undefined) {
//     if(symbol.other.jdata_type == "broadcaster" ) {
//         error(left, 'Cannot save to broadcaster ' + left.cTranslator);
//     } else if(symbol.other.jdata_type == "logger") {
//       console.log(`jdata_log_to_server(${left.cTranslator}, "${right.cTranslator}", NULL)`);
//       return `jdata_log_to_server(${left.cTranslator}, "${right.cTranslator}", NULL)`; 
//     }
//   }
//   return left.cTranslator + ' ' + op.sourceString + ' ' + right.cTranslator;
// }

cTranslator.Dir_declarator_Id = function(id) {
  var symbol = symbolTable.get(id.sourceString);
  if(symbol !== undefined) {
    if(symbol.other.jdata_type == "broadcaster" ) {
        error(id, 'Cannot declare broadcaster ' + id.sourceString);
    }
  }
  return id.sourceString;
}

// cTranslator.Dir_declarator_PCall = function(name, params) {
//   console.log(name.cTranslator);
//   return name.cTranslator + params.cTranslator;
// }

cTranslator.Left_expr_Call = function(left, call) {
  var res = symbolTable.get(left.cTranslator);
  if(res !== undefined && (res == "function" || res == "activity")) {
    callGraph.c.get(currentFunction).add(left.cTranslator);
  }
  return left.cTranslator + call.cTranslator;
}

cTranslator.Primary_expr = function(node) {
  if(node.ctorName == "id") {
    var symbol = symbolTable.get(node.sourceString);
    if(symbol !== undefined && symbol.type == "jdata") {
      if(symbol.other.jdata_type == "logger" 
        || symbol.other.jdata_type == "shuffler") {
          error(node, 'Cannot read values from ' + symbol.other.jdata_type + ' ' + node.sourceString);
      } else if(symbol.other.jdata_type == "broadcaster") {
        return `(${symbol.other.type_spec})get_jbroadcaster_value(${node.sourceString})`
      } else if(symbol.other.jdata_type == "shuffler") {
        return `(char *)jshuffler_poll(${node.sourceString});`
      }
    }
  }
  return node.cTranslator;
}

cTranslator.Assign_stmt = function(left, _1, right, _4) {
  var symbol = symbolTable.get(left.cTranslator);
  if(symbol !== undefined) {
    if(symbol.other.jdata_type == "broadcaster" ) {
        error(id, 'Cannot declare broadcaster ' + id.sourceString);
    } else if(symbol.other.jdata_type == "logger") {
      return `jdata_log_to_server("${left.cTranslator}", ${right.cTranslator}, ((void*)0));`; 
    } else if(symbol.other.jdata_type == "shuffler") {
      return `jshuffler_push(${left.cTranslator}, ${right.cTranslator});`; 
    }
  }
  return left.cTranslator + ' = ' + right.cTranslator + ';';
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
    if(!callGraph.c.has(fname)) {
      callGraph.c.set(fname, new Set());
    }
    symbolTable.enterScope();
    params.forEach(function(param) {
        var index = param.lastIndexOf(' ');
        symbolTable.set(param.substring(index+1), param.substring(0, index));
      }, this);
    var cout = specs.cTranslator + " " + declaration + " " + stmts.cTranslator;
    symbolTable.exitScope();
    return cout;
  },


es5Translator.AssignmentStatement = function(left, _, right) {
  var symbol = symbolTable.get(left.es5Translator);
  if(symbol !== undefined) {
    if(symbol.other.jdata_type == "broadcaster" ) {
      return `JManager.broadcastMessage("${left.es5Translator}", "${right.es5Translator}");`;
    } else if(symbol.other.jdata_type == "logger") {
        error(left, `Cannot write to logger var ${left.es5Translator} from javascript`);
    }
  }
  return left.es5Translator + ' = ' + right.es5Translator + ';';
}

es5Translator.CallExpression_memberExpExp = function(exp, args) {
  callGraph.js.get(currentFunction).add(exp.es5Translator);
  return exp.es5Translator + args.es5Translator;
}

es5Translator.CallExpression_callExpExp = function(exp, args) {
  callGraph.js.get(currentFunction).add(exp.es5Translator);
  return exp.es5Translator + args.es5Translator;
}

es5Translator.FunctionDeclaration = function(_1, id , _2, params, _3, _4, body, _5) {
  currentFunction = id.es5Translator;
  jsFunctions.add(currentFunction);
  if(!callGraph.js.has(currentFunction)) {
    callGraph.js.set(currentFunction, new Set());
  }
  return `function ${id.es5Translator}(${params.es5Translator}) {\n${body.es5Translator}}`;
}
es5Translator.FunctionExpression_named = function(_1, id , _2, params, _3, _4, body, _5) {
  currentFunction = id.es5Translator;
  jsFunctions.add(currentFunction);
  if(!callGraph.js.has(currentFunction)) {
    callGraph.js.set(currentFunction, new Set());
  }
  return `function ${id.es5Translator}(${params.es5Translator}) {\n${body.es5Translator}}`;
}
es5Translator.FunctionExpression_anonymous = function(_1, _2, params, _3, _4, body, _5) {
  currentFunction = "anonymous";
  jsFunctions.add(currentFunction);
  if(!callGraph.js.has(currentFunction)) {
    callGraph.js.set(currentFunction, new Set());
  }
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
jsSemantics.addAttribute('jamJSTranslator', jamJSTranslator);
jsSemantics.addAttribute('es5Translator', es5Translator);
// semantics.addAttribute('cSymbolTable', cSymbolTable);

module.exports = {
  jamJSGrammar: jamJSGrammar,
  jamCGrammar: jamCGrammar,
  cSemantics: cSemantics,
  jsSemantics: jsSemantics
};
