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
var types = require('./types');
var callGraph = require('./callGraph');
var jdata = require('./jdata');
var activities = require('./activities');

var namespace_funcs    = [];

var currentFunction    = "";
var jsFunctions        = new Set();
var jsActivities       = new Map();
var jConditions        = new Map();
var prototypes         = new Map();
var cActivities        = new Map();
var cCallbackActivities = new Set();

function error(message) {
  throw message;
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
      if(data.type === "async") {
        result = activities.CreateJSASyncJSFunction(name, data.cParams, data.jsParams, data.block);
      } else {
        result = activities.CreateJSSyncJSFunction(data.returnType, name, data.cParams, data.jsParams, data.block);
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
  // jsout += '});\n'; // Close main function and launch fiber
  return jsout;
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
    jsout = jdata.generateJSLoggerVars(symbolTable.getGlobals()) + jsout;

    var requires = '';
    requires += "var jamlib = require('/usr/local/share/jam/lib/jserver/jamlib');\n";
    requires += "var jnode = require('/usr/local/share/jam/lib/jserver/jnode');\n";

    requires += "var http = require('http');\n";
    requires += "var cbor = require('cbor');\n";
    requires += "var qs = require('querystring');\n";
    requires += "var path = require('path');\n";
    requires += "var mime = require('mime');\n";
    requires += "var fs = require('fs');\n";
    requires += "var deasync = require('deasync');\n";

    if(hasJdata) {
      requires += "var JAMLogger = require('/usr/local/share/jam/lib/jserver/jamlogger');\n";
      requires += "var JAMManager = require('/usr/local/share/jam/lib/jserver/jammanager');\n";
    }
    // jsout = "Sync(function() {\n" + jsout + "\n"; // Open main function
    // annotated_JS = "Sync(function() {\n" + annotated_JS + "\n";// Open main function

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
    jsActivities.set(specs.fname, {
      type: "sync",
      jsParams: specs.params,
      jCond: jCond,
      block: specs.block.es5Translator,
      signature: Array(specs.params.length).fill("x")
    });
    return activities.CreateJSSyncMachFunction(specs.fname, jCond, specs.params);
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
    jsActivities.set(specs.fname, {
      type: "async",
      name: specs.fname,
      jsParams: specs.params,
      jCond: jCond,
      block: specs.block.es5Translator,
      signature: Array(specs.params.length).fill("x")
    });
    return activities.CreateJSAsyncMachFunction(specs.fname, jCond, specs.params);
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
    if(decl.pointer != '') {
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

    callGraph.pruneJSCallGraph(jsFunctions, jsActivities, cActivities);
    callGraph.checkCalls(symbolTable);

    cout = jdata.createCVariables(symbolTable.getGlobals()) + cout;
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

    if(jsActivities.has(id.cTranslator)) {
      var activity = jsActivities.get(id.cTranslator);
      var jParams = activity.jsParams;
      var block = activity.block;
      var jCond = activity.jCond;

      var js_codes = [];
      for(var i = 0; i < parameters.length; i++) {
        if (typeof(parameters[i]) == 'object')
          js_codes.push(types.getJSCode(parameters[i].type));
        else 
          js_codes.push(types.getJSCode(parameters[i]));

      }

      if(activity.type == "sync") {
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
        return `${types.getStringCast(symbol.type_spec)}(get_jbroadcaster_value(${node.sourceString}))`
      } else if(symbol.jdata_type == "shuffler") {
        return `(char *)jshuffler_poll(${node.sourceString});`
      }
    }
  }
  return node.cTranslator;
}

cTranslator.Assign_stmt_named = function(namespace, _1, id, _2, expr, _3) {
  var symbol = symbolTable.get(namespace.sourceString);
  if(symbol !== undefined && symbol.type == "jdata namespace") {
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
      jsParams: params.jamJSTranslator,
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
