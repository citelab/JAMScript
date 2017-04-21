/* eslint-env node */

'use strict';

var fs = require('fs');
var path = require('path');

var ohm = require('ohm-js');
var cTranslator = require('../c/c').cTranslator;
var jCondTranslator = require('./jCondTranslator');
var symbolTable = require('./symbolTable');
var types = require('./types');
var callGraph = require('./callGraph');
var jdata = require('./jdata');
var activities = require('./activities');

var namespace_funcs    = [];
var currentFunction    = "";
var jsActivities;
var prototypes         = new Map();
var cActivities        = new Map();
var cCallbackActivities = new Set();

function error(message) {
  throw message;
}

var jamCTranslator = {
  Namespace_spec: function(_, namespace) {
    return namespace.sourceString;
  },
  Sync_activity: function(_, specs, jCond_spec, declarator, namespace, stmt) {
    var c_codes = [];
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
      c_codes.push(types.getCCode(params[i].type));
      symbolTable.set(params[i].name, params[i].type);
    }
    cActivities.set(funcname, {
      codes: c_codes,
      type: "sync"
    });
    var rtype = specs.cTranslator;
    if(decl.pointer !== '') {
      rtype += decl.pointer
    }
    var namespc;
    if(namespace.numChildren > 0) {
      namespc = namespace.jamCTranslator
      // funcname = namespc + "_func_" + namespace_funcs[namespc].indexOf(funcname);
    }

    var js_output = activities.CreateCSyncJSFunction(funcname, jCond, params);
    var c_output = activities.CreateCSyncCFunction(rtype, funcname, params, stmt.cTranslator);

    symbolTable.exitScope();

    return {
      C: c_output,
      JS: js_output.JS,
      annotated_JS: js_output.annotated_JS
    }
  },
  Async_activity: function(_, jCond_spec, decl, namespace, stmt) {
    var c_codes = [];
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
      c_codes.push(types.getCCode(params[i].type));
    }
    cActivities.set(funcname, {
      codes: c_codes,
      type: "async"
    });
    if(namespace.numChildren > 0) {
        // funcname = namespc + "_func_" + namespace_funcs[namespc].indexOf(funcname);
    }

    var js_output = activities.CreateCASyncJSFunction(funcname, jCond, params);
    var c_output = activities.CreateCASyncCFunction("jactivity_t*", funcname, params, stmt.cTranslator);
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
      if(decls.child(i).child(0).ctorName === "Activity_def") {
        var output = decls.child(i).child(0).jamCTranslator;
        cout += output.C + '\n';
        jsout += output.JS + '\n';
        annotated_JS += output.annotated_JS + '\n';
      } else if(decls.child(i).child(0).ctorName === "Prototype") {
        if(decls.child(i).child(0).sourceString === "int main();") { 
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

    if(jsActivities.has(id.cTranslator)) {
      var activity = jsActivities.get(id.cTranslator);
      var jParams = activity.jsParams;
      var block = activity.block;
      var jCond = activity.jCond;

      var js_codes = [];
      for(var i = 0; i < parameters.length; i++) {
        if (typeof(parameters[i]) === 'object')
          js_codes.push(types.getJSCode(parameters[i].type));
        else 
          js_codes.push(types.getJSCode(parameters[i]));

      }

      if(activity.type === "sync") {
        // Sync
        for(var i = 0; i < parameters.length; i++) {
          if(parameters[i] === "jcallback") {
            error("jcallback cannot be used in synchronous activity " + id.cTranslator);
          }
        }
        c_output = activities.CreateJSSyncCFunction(rtype, id.cTranslator, parameters, jParams, jCond);
        activity.signature = js_codes;
        activity.returnType = rtype;
        activity.cParams = parameters;
      } else {
        // Async
        c_output = activities.CreateJSASyncCFunction(id.cTranslator, parameters, jParams, jCond);

        activity.signature = js_codes;
        activity.cParams = parameters;
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
    if(decl.jamCTranslator.pointer !== '') {
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
      if (childResults[i] !== null) {
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
//     if(symbol.jdata_type === "broadcaster" ) {
//         error('Cannot save to broadcaster ' + left.cTranslator);
//     } else if(symbol.jdata_type === "logger") {
//       return `jdata_log_to_server(${left.cTranslator}, "${right.cTranslator}", NULL)`; 
//     }
//   }
//   return left.cTranslator + ' ' + op.sourceString + ' ' + right.cTranslator;
// }

cTranslator.Dir_declarator_Id = function(id) {
  var symbol = symbolTable.get(id.sourceString);
  if(symbol !== undefined) {
    if(symbol.jdata_type === "broadcaster" ) {
        error('Cannot declare broadcaster ' + id.sourceString);
    }
  }
  return id.sourceString;
}

// cTranslator.Dir_declarator_PCall = function(name, params) {
//   return name.cTranslator + params.cTranslator;
// }

cTranslator.Left_expr_Call = function(left, params) {
  var paramString;
  var cout = "";

  if(prototypes.has(left.cTranslator)) {
    var paramArray = [];
    var prototypeParams = prototypes.get(left.cTranslator).params;
    for (var i = 0; i < prototypeParams.length; i++) {
      if(prototypeParams[i] === "jcallback") {
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
  } else if(symbolTable.has(left.cTranslator) && symbolTable.get(left.cTranslator) === "jcallback") {
      var cout = 'jactivity_t *jact = jam_create_activity(js);\n';
      cout += 'jactivity_t *res = jam_rexec_async(js, jact, "true", 0, ' + left.cTranslator 
        + ', "%s", ' + params.cTranslator.substring(1, params.cTranslator.length - 1) + ');\n';
      cout += 'activity_free(jact);\n';
      return cout;
  } else {
    paramString = params.cTranslator;
  }
  var res = symbolTable.get(left.cTranslator);
  if(res !== undefined && (res === "function" || res.type === "activity")) {
    callGraph.addCall('c', currentFunction, left.cTranslator, params.cTranslator);
  }
  return left.cTranslator + paramString;
}

cTranslator.Primary_expr = function(node) {
  if(node.ctorName === "id") {
    var symbol = symbolTable.get(node.sourceString);
    if(symbol !== undefined && symbol.type === "jdata") {
      if(symbol.jdata_type === "logger" 
        || symbol.jdata_type === "shuffler") {
          error('Cannot read values from ' + symbol.jdata_type + ' ' + node.sourceString);
      } else if(symbol.jdata_type === "broadcaster") {
        return `${types.getStringCast(symbol.type_spec)}(get_jbroadcaster_value(${node.sourceString}))`
      } else if(symbol.jdata_type === "shuffler") {
        return `(char *)jshuffler_poll(${node.sourceString});`
      }
    }
  }
  return node.cTranslator;
}

cTranslator.Assign_stmt_named = function(namespace, _1, id, _2, expr, _3) {
  var symbol = symbolTable.get(namespace.sourceString);
  if(symbol !== undefined && symbol.type === "jdata namespace") {
    if(symbol.children.has(id.sourceString)) {
      var child = symbol.children.get(id.sourceString);
      return jdata.createJdataCall(namespace.sourceString, id.sourceString, expr.cTranslator, child.jdata_type, child.type_spec);
    }
  }
  return namespace.sourceString + '.' + id.sourceString + ' = ' + expr.cTranslator + ';';
}

cTranslator.Assign_stmt_anonymous = function(id, _1, expr, _2) {
  var symbol = symbolTable.get(id.sourceString);
  if(symbol !== undefined && symbol.type === "jdata") {
    return jdata.createJdataCall("global", id.sourceString, expr.cTranslator, symbol.jdata_type, symbol.type_spec);
  }
  return id.sourceString + ' = ' + expr.cTranslator + ';';
}

cTranslator.Function_def = function(specs, decl, stmts) {
    var declaration = '';
    var fname = '';
    var params = [];
    if(decl.cTranslator === "main()") {
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
  if(list.child(0).ctorName === "NonemptyListOf") {
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


function generateCActivities() {
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
  cout += generateCActivities();
  cout += jdata.linkCVariables(symbolTable.getGlobals());
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

var jamc = fs.readFileSync(path.join(__dirname, 'jamc.ohm'));
var ns = { C: ohm.grammar(fs.readFileSync(path.join(__dirname, '../c/c.ohm'))) };
var jamCGrammar = ohm.grammar(jamc, ns);
var semantics = jamCGrammar.createSemantics();

semantics.addAttribute('jamCTranslator', jamCTranslator);
semantics.addAttribute('cTranslator', cTranslator);
semantics.addAttribute('jCondTranslator', jCondTranslator.jCondTranslator);

module.exports = {
  translate: function(tree, jsActs) {
    jsActivities = jsActs;
    var results = semantics(tree).jamCTranslator;
    var cout = "";
    cout += 'jamstate_t *js;\n';
    cout += 'typedef char* jcallback;\n';
    cout += 'char jdata_buffer[20];\n';
    cout += 'char app_id[256] = { 0 };\n';
    cout += jdata.createCVariables(symbolTable.getGlobals());
    cout += results.C;
    cout += generate_c_activity_wrappers();
    cout += generate_setup();
    cout += generate_jam_run_app();
    cout += generate_taskmain();
    
    results.C = cout;
    results.cActivities = cActivities;

    return results;
  },
  jamCGrammar: jamCGrammar
}