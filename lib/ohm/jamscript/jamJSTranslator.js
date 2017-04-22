/* eslint-env node */

'use strict';

var fs = require('fs');
var path = require('path');

var ohm = require('ohm-js');
var es5Translator = require('../ecmascript/es5').es5Translator;
var jCondTranslator = require('./jCondTranslator');
var symbolTable = require('./symbolTable');
var callGraph = require('./callGraph');
var jdata = require('./jdata');
var activities = require('./activities');

var currentFunction    = "";

var jamJSTranslator = {  
  Program: function(directives, elements) {
    var jsout = "";
    var annotated_JS = "";
    var hasJdata = false;
    jsout += "var jcondition = new Map();\n"
    callGraph.addFunction('js', 'root');
    currentFunction = "root";
    for (var i = 0; i < elements.children.length; i++) {
      if(elements.child(i).child(0).child(0).ctorName === "Activity_def") {
        // var output = elements.child(i).child(0).child(0).jamJSTranslator;
        // cout += output.C + '\n';
        // jsout += output.JS + '\n';
        // annotated_JS += output.annotated_JS + '\n';
        jsout += elements.child(i).child(0).child(0).jamJSTranslator;
      } else if(elements.child(i).child(0).child(0).ctorName === "Jconditional") {
        jsout += elements.child(i).child(0).child(0).jamJSTranslator;
      } else if(elements.child(i).child(0).child(0).ctorName === "Jdata_decl") { 
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

    return {'JS': jsout, 'annotated_JS': annotated_JS};
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
      throw "Invalid start date " + startTime.sourceString;
    }
    if(endTime.numChildren > 0) {
      var endDate = Date.parse(endTime.sourceString);
      if(isNaN(endDate)) {
        throw "Invalid end date: " + endTime.sourceString;
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
    if(right.sourceString === "sys.type") {
      if(left.sourceString === "sys.type") {
        throw "Cannot have sys.type as both sides of expression";
      } else {
        var temp = right;
        right = left;
        left = temp;
      }
    }
    if(left.sourceString === "sys.type") {
      if(op.sourceString === "==") {
        if(right.sourceString === '"dev"') {
          code = 1;
        } else if(right.sourceString === '"fog"') {
          code = 2;
        } else if(right.sourceString === '"cloud"') {
          code = 4;
        }
      } else if(op.sourceString === "!=") {
        if(right.sourceString === '"dev"') {
          code = 6;
        } else if(right.sourceString === '"fog"') {
          code = 5;
        } else if(right.sourceString === '"cloud"') {
          code = 3;
        }
      } else {
        throw "Operator " + op.sourceString + " not compatible with sys.type";
      }
    } else if(left.sourceString === "sys.sync") {
      if(op.sourceString === ">=" || op.sourceString === "==") {
        if(right.child(0).ctorName === "literal" && Number(right.sourceString) > 0) {
            code = code | 8;
        }
      }
    } else if(left.child(0).ctorName !== "literal" || right.child(0).ctorName !== "literal") {
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
      jCondTranslator.set(namespace + entry.name, { source: entry.string, code: entry.code });
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

    callGraph.addActivity('js', specs.fname, "sync");
    symbolTable.addActivity(specs.fname, {
      language: 'js',
      activityType: "sync",
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
    callGraph.addActivity('js', specs.fname, "async");
    symbolTable.addActivity(specs.fname, {
      language: 'js',
      activityType: "async",
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
    if(params.child(0).ctorName === "NonemptyListOf") {
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
    if(symbol.jdata_type === "broadcaster" ) {
      var value;
      // Convert value to a string
      if(symbol.type_spec === "char*") {
        value = `String(${right.es5Translator})`;
      } else {
        value = `String(Number(${right.es5Translator}))`;
      }
      return `JAMManager.broadcastMessage("${leftSide}", ${value});`;
    } else if(symbol.jdata_type === "logger") {
        throw `Cannot write to logger var ${sideSide} from javascript`;
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
  if(params.jamJSTranslator.length === 1) {
    symbolTable.addActivity(currentFunction, {
      language: 'js',
      activityType: "async",
      type: "callback",
      signature: ["x"],
      jsParams: params.jamJSTranslator,
      block: body.es5Translator
    });
  }
  symbolTable.addFunction(currentFunction, 'js');
  callGraph.addFunction('js', currentFunction);
  return `function ${id.es5Translator}(${params.es5Translator}) {\n${body.es5Translator}}`;
}
es5Translator.FunctionExpression_named = function(_1, id , _2, params, _3, _4, body, _5) {
  currentFunction = id.es5Translator;
  symbolTable.addFunction(currentFunction, 'js');
  callGraph.addFunction('js', currentFunction);
  return `function ${id.es5Translator}(${params.es5Translator}) {\n${body.es5Translator}}`;
}
es5Translator.FunctionExpression_anonymous = function(_1, _2, params, _3, _4, body, _5) {
  currentFunction = "anonymous";
  symbolTable.addFunction(currentFunction, 'js');
  callGraph.addFunction('js', currentFunction);
  return `function (${params.es5Translator}) {\n${body.es5Translator}}`;
}

function generateMbox() {
  var jsout = 'var mbox = {\n';
  jsout += '"functions": {\n';
  for(const [name, data] of symbolTable.activities.js) {
    jsout += `"${name}": call${name},\n`;
  }
  jsout += '},\n';
  jsout += '"signatures": {\n';
  for(const [name, data] of symbolTable.activities.js) {
    jsout += `"${name}": "${data.signature.join('')}",\n`;
  }
  jsout += '}\n';
  jsout += '}\n';
  
  jsout += 'jamlib.registerFuncs(mbox);\n';
  jsout += 'jamlib.run(function() { console.log("Running..."); } );\n';
  // jsout += '});\n'; // Close main function and launch fiber
  return jsout;
}

var jamjs = fs.readFileSync(path.join(__dirname, 'jamjs.ohm'));
var ns = { ES5: ohm.grammar(fs.readFileSync(path.join(__dirname, '../ecmascript/es5.ohm'))) };
var jamJSGrammar = ohm.grammar(jamjs, ns);
var semantics = jamJSGrammar.createSemantics();

semantics.addAttribute('jamJSTranslator', jamJSTranslator);
semantics.addAttribute('es5Translator', es5Translator);
semantics.addAttribute('jCondTranslator', jCondTranslator.jCondTranslator);

function translate(tree) {
    var output = semantics(tree).jamJSTranslator;

    var results = activities.generateJSActivities(symbolTable.activities.js);
    output.JS += results.JS;
    output.annotated_JS += results.annotated_JS;

    output.JS += generateMbox();
    output.annotated_JS += generateMbox();
    
    return output;
}

module.exports = {
  compile: function(input) {
  console.log("Parsing JS Files...");
  var jsTree = jamJSGrammar.match(input, 'Program');
  if(jsTree.failed()) {
    throw jsTree.message;
  }
  console.log("Generating JavaScript Code...");
  return translate(jsTree);
  }
}