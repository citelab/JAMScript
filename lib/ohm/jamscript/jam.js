/* eslint-env node */

'use strict';

// --------------------------------------------------------------------
// Imports
// --------------------------------------------------------------------

var fs = require('fs');
var path = require('path');

var ohm = require('ohm-js');
var cTranslator = require('../c/c').cTranslator;
var cSymbolTable = require('../c/c').cSymbolTable;
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
              'char *': {
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
  symbolTable.forEach(function(value, key, map) {
    if(value.type == 'jdata' && value.other.jdata_type == 'logger') {
      jsout += `var ${key} = new JLogger("${key}", false, JManager);\n`;
    }
  });
  return jsout;
}

function generate_c_broadcaster_vars() {
  var cout = '';
  symbolTable.forEach(function(value, key, map) {
    if(value.type == 'jdata' && value.other.jdata_type == 'broadcaster') {
      cout += `jbroadcaster *${key} = jbraodcaster_init(JBROADCAST_STRING, "${key}", ((void*)0));\n`;
    }
  });
  return cout;
}

function generate_c_shuffler_vars() {
  var cout = '';
  symbolTable.forEach(function(value, key, map) {
    if(value.type == 'jdata' && value.other.jdata_type == 'shuffler') {
      cout += `jbroadcaster *${key} = jshuffler_init(JBROADCAST_STRING, "${key}", ((void*)0));\n`;
    }
  });
  return cout;
}

function generate_js_callbacks() {
  var jsout = '';
  for (var i = 0; i < callbacks.js.sync.length; i++) {
    var callback = callbacks.js.sync[i];
    jsout += 'jlib.JServer.registerCallback(' + callback[0] + ', "' + callback[1].join('') + '");\n';
  }
  for (var i = 0; i < callbacks.js.async.length; i++) {
    var callback = callbacks.js.async[i];
    jsout += 'jlib.JServer.registerCallback(' + callback[0] + ', "' + callback[1].join('') + '");\n';
  }
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

function generate_setup() {
  var cout = '\nvoid user_setup() {\n';
  cout += generate_c_activities();
  cout += '}\n';
  return cout;
}                   

function generate_taskmain() {
  var cout = `\nvoid taskmain(int argc, char **argv) {\n
    js = jam_init();
    user_setup();
     
    taskcreate(jam_event_loop, js, 50000);
    taskcreate(jam_run_app, js, 50000);
  }`;
  return cout;
}

function CreateCASyncJSFunction(fname, params) {
  var ps = [];
  params.forEach(function(p) {
    ps.push(p.name);
  });
  var funccode = "function " + fname + "(" + ps.join(',') + ") {";

  // write the code that would call the remote function
  funccode += 'jlib.JServer.remoteAsyncExec("' + fname + '", [' + ps.join(',') + '], "true");';

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
  cout += 'void ' + fname + '(' + typed_params.join(", ") + ')' + stmt;

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
  funccode += 'await (jlib.JServer.remoteSyncExec("' + fname + '", [' + ps.join(',') + '], "true"));\n';

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
  console.log(params);
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

function CreateJSASyncJSFunction(fname, params, stmt) {
  var ps = [];
  var annotated_ps = [];
  var js_codes = [];
  params.forEach(function(p) {
    ps.push(p.name);
    annotated_ps.push(p.name + ':' + types[p.type].js_type);
    js_codes.push(types[p.type].js_code);
  });
        
  var jsout = "function " + fname + "(" + ps.join(',') + ")" + stmt;
  var annotated_jsout = "function " + fname + "(" + annotated_ps.join(',') + "): void" + stmt;

  callbacks.js.async.push([fname, js_codes, undefined]);
  return {
    JS: jsout, 
    annotated_JS: annotated_jsout
  };
}

function CreateJSASyncCFunction(fname, params) {
  var ps = [], qs = [], c_codes = [];
  params.forEach(function(p) {
    ps.push(p.type +  ' ' + p.name);
    qs.push(p.name);
    c_codes.push(types[p.type].c_code);
  });

  var cout = "jactivity_t *" + fname + "(" + ps.join(', ') + ") {\n";
  cout += 'jactivity_t *res = jam_rexec_async(js, "' + fname + '", "' + c_codes.join('') + '"';
  if(qs.length > 0) {
    cout += ',' + qs.join(', ');
  }
  cout += ');\n';

  cout += 'return res;';
  cout += '}\n';

  return cout;
}

function CreateJSSyncJSFunction(rtype, fname, params, stmt) {
  var ps = [];
  var annotated_ps = [];
  var js_codes = [];
  params.forEach(function(p) {
    ps.push(p.name);
    annotated_ps.push(p.name + ':' + types[p.type].js_type);
    js_codes.push(types[p.type].js_code);
  });
  
  var js_return_type;
  if(rtype == "void") {
    js_return_type = "void";
  } else {
    js_return_type = types[rtype].js_type;
  }

  var jsout = "function " + fname + "(" + ps.join(',') + ")" + stmt;
  var annotated_jsout = "function " + fname + "(" + annotated_ps.join(',') + "):" + js_return_type + stmt;

  callbacks.js.sync.push([fname, js_codes, undefined]);
  return {
    JS: jsout, 
    annotated_JS: annotated_jsout
  };
}

function CreateJSSyncCFunction(dspec, fname, params) {
  var ps = [], qs = [];
  var c_codes = [];
  params.forEach(function(p) {
    ps.push(p.type + ' '  + p.name);
    qs.push(p.name);
    c_codes.push(types[p.type].c_code);
  });

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
    if(dspec == 'char *') {
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
  var code = list.child(0).jamTranslator;
  var rest = list.child(2);
  for (var i = 0; i < rest.numChildren; i++) {
    code += sep + rest.child(i).jamTranslator
  }
  return code;
}

function parseArrayList(list, sep) {
  var code = '';
  for (var i = 0; i < list.numChildren; i++) {
    code += list.child(i).jamTranslator + sep;
  }
  return code;
}
var symbolTable = new Map();

var jamTranslator = {
  jdata_type: function(type) {
    return type.sourceString;
  },
  Jdata_spec: function(type_spec, id, _1, jdata_type, _2) {
    // console.log(id.sourceString + ": " + type_spec.cTranslator + " " + jdata_type.jamTranslator);
    symbolTable.set(id.sourceString, {
      type: "jdata",
      other: {
        type_spec: type_spec.cTranslator,
        jdata_type: jdata_type.jamTranslator
      }
    });
  },
  Jdata_decl: function(_1, _2, jdata_spec, _3) {
    jdata_spec.jamTranslator;
    return '';
  },
  Namespace_spec: function(_, namespace) {
    return namespace.sourceString;
  },
  Sync_activity: function(node) {
    return node.jamTranslator;
  },
  Async_activity: function(node) {
    return node.jamTranslator;
  },
  Activity_def: function(node) {
    return node.jamTranslator;
  },
  Program: function(decls) {
    var cout = "";
    var jsout = "";
    var annotated_JS = "";

    for (var i = 0; i < decls.numChildren; i++) {
      if(decls.child(i).child(0).ctorName == "Jdata_decl") {
        decls.child(i).child(0).jamTranslator;
      } else if(decls.child(i).child(0).ctorName == "Activity_def") {
        var output = decls.child(i).child(0).jamTranslator;
        cout += output.C + '\n';
        jsout += output.JS + '\n';
        annotated_JS += output.annotated_JS + '\n';
      } else {
        cout += decls.child(i).child(0).cTranslator + '\n';
      }
    }

    // cout += generate_c_async_callbacks(input.data.cCallbacks);
    cout = generate_c_broadcaster_vars() + cout;
    cout += generate_setup();
    cout += generate_jam_run_app();
    cout += generate_taskmain();
    jsout = generate_js_logger_vars() + jsout;
    jsout += generate_js_callbacks();

    // annotated_JS = "/* @flow */\n" + struct_objects + annotated_JS + this.generate_js_callbacks();

    return {'C': cout, 'JS': jsout, 'annotated_JS': annotated_JS};
  },
  Async_decl: function(_, declarator, namespace) {
    var funcname = declarator.jamTranslator.name;
    var params   = declarator.jamTranslator.params;
    if(namespace.numChildren > 0) {
        // funcname = namespc + "_func_" + namespace_funcs[namespc].indexOf(funcname);
    }
    return {
        declspec: "jactivity",
        fname: funcname,
        params: params
    };
  },
  Sync_decl: function(_, decl_specs, declarator, namespace) {
    var decl = declarator.jamTranslator;
    var funcname = decl.name;
    var params = decl.params;
    var rtype = decl_specs.cTranslator;
    if(decl.pointer != '') {
      rtype += ' ' + decl.pointer
    }
    var namespc;
    if(namespace.numChildren > 0) {
      namespc = namespace.jamTranslator
      // funcname = namespc + "_func_" + namespace_funcs[namespc].indexOf(funcname);
    }

    return {
      declspec: rtype,
      fname: funcname,
      params: params,
      namespace: namespc
    };
  },
  Pcall_decl: function(node) {
    return node.jamTranslator;
  },
  Pcall_decl_ParamTypeList: function(_1, node, _2) {
    return node.jamTranslator;
  },
  Pcall_decl_Empty: function(_1, _2) {
    return [];
  },
  Param_type_lst: function(param_list) {
    var params = []
    params.push(param_list.child(0).jamTranslator);
    var rest = param_list.child(2);
    for (var i = 0; i < rest.numChildren; i++) {
      params.push(rest.child(i).jamTranslator);
    }
    return params;
  },
  Declarator: function(pointer, dir_declarator, _1, _2) {
    var dir_decl = dir_declarator.jamTranslator;
    return {
      pointer: pointer.cTranslator,
      name: dir_decl.name,
      params: dir_decl.params
    }
  },
  Dir_declarator_PCall: function(name, params) {
    return {
      name: name.cTranslator,
      params: params.jamTranslator
    };
  },
  Dir_declarator_Id: function(id) {
    return {
      name: id.cTranslator
    }
  },
  Dir_declarator: function(node) {
    return node.jamTranslator;
  },
  Param_decl: function(node) {
    return node.jamTranslator;
  },
  Param_decl_Declarator: function(decl_specs, decl) {
    var varType = decl_specs.cTranslator;
    if(decl.jamTranslator.pointer != '') {
      varType += ' ' + decl.jamTranslator.pointer
    }
    return {
      type: varType,
      name: decl.jamTranslator.name 
    };
  },
  C_as_activity: function(decl, stmt) {
    var specs = decl.jamTranslator;
    var js_output = CreateCASyncJSFunction(specs.fname, specs.params);
    var c_output = CreateCASyncCFunction(specs.declspec, specs.fname, specs.params, stmt.cTranslator);
    return {
      C: c_output,
      JS: js_output.JS,
      annotated_JS: js_output.annotated_JS
    }
  },
  Js_as_activity: function(decl, block) {
    var specs = decl.jamTranslator;
    var js_output = CreateJSASyncJSFunction(specs.fname, specs.params, block.es5Translator);
    var c_output = CreateJSASyncCFunction(specs.fname, specs.params);
    return {
      C: c_output,
      JS: js_output.JS,
      annotated_JS: js_output.annotated_JS
    }
  },
  C_s_activity: function(decl, stmt) {
    var specs = decl.jamTranslator;
    var js_output = CreateCSyncJSFunction(specs.fname, specs.params);
    var c_output = CreateCSyncCFunction(specs.declspec, specs.fname, specs.params, stmt.cTranslator);
    return {
      C: c_output,
      JS: js_output.JS,
      annotated_JS: js_output.annotated_JS
    }
  },
  Js_s_activity: function(decl, block) {
    var specs = decl.jamTranslator;
    var js_output = CreateJSSyncJSFunction(specs.declspec, specs.fname, specs.params, block.es5Translator);
    var c_output = CreateJSSyncCFunction(specs.declspec, specs.fname, specs.params);
    return {
      C: c_output,
      JS: js_output.JS,
      annotated_JS: js_output.annotated_JS
    }
  },
  _nonterminal: function(children) {
    var flatChildren = flattenIterNodes(children).sort(compareByInterval);
    var childResults = flatChildren.map(function(n) { return n.jamTranslator; });
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
    var code = first.jamTranslator;
    for (var i = 0; i < rest.numChildren; i++) {
      code += sep.child(i).primitiveValue + ' ' + rest.child(i).jamTranslator;
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

cTranslator.Primary_expr = function(node) {
  if(node.ctorName == "id") {
    var symbol = symbolTable.get(node.sourceString);
    if(symbol !== undefined && symbol.type == "jdata") {
      if(symbol.other.jdata_type == "logger" 
        || symbol.other.jdata_type == "shuffler") {
          error(node, 'Cannot read values from ' + symbol.other.jdata_type + ' ' + node.sourceString);
      } else if(symbol.other.jdata_type == "broadcaster") {
        return `get_broadcaster_value(${node.sourceString});`
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
      return `jdata_log_to_server("${left.cTranslator}", "${right.cTranslator}", ((void*)0));`; 
    } else if(symbol.other.jdata_type == "shuffler") {
      return `jshuffler_push("${left.cTranslator}", "${right.cTranslator}");`; 
    }
  }
  return left.cTranslator + ' = ' + right.cTranslator + ';';
}

es5Translator.AssignmentStatement = function(left, _, right) {
  var symbol = symbolTable.get(left.es5Translator);
  if(symbol !== undefined) {
    if(symbol.other.jdata_type == "broadcaster" ) {
      return `JManager.broadcastMessage("${left.es5Translator}", "${right.es5Translator}"");`;
    } else if(symbol.other.jdata_type == "logger") {
        error(left, `Cannot write to logger var ${left.es5Translator} from javascript`);
    }
  }
  return left.es5Translator + ' = ' + right.es5Translator + ';';
}

// Instantiate the JAMScript grammar.
var contents = fs.readFileSync(path.join(__dirname, 'jam.ohm'));
var ns = {};
ns.ES5 = ohm.grammar(fs.readFileSync(path.join(__dirname, '../ecmascript/es5.ohm')));
ns.C = ohm.grammar(fs.readFileSync(path.join(__dirname, '../c/c.ohm')), ns);
var g = ohm.grammar(contents, ns);
var semantics = g.createSemantics();

semantics.addAttribute('jamTranslator', jamTranslator);
semantics.addAttribute('cTranslator', cTranslator);
semantics.addAttribute('es5Translator', es5Translator);
semantics.addAttribute('cSymbolTable', cSymbolTable);

module.exports = {
  grammar: g,
  semantics: semantics
};
