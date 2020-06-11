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

var currentFunction = "";
var prototypes = new Map();
var cCallbackActivities = new Set();

var jamCTranslator = {
    Namespace_spec: function(_, namespace) {
        return namespace.sourceString;
    },
    Sync_activity: function(_, specs, jCond_spec, declarator, namespace, stmt) {
        var c_codes = [];
        var jCond = {
            source: "true",
            code: 0,
            cback: "",
            bcasts: JSON.stringify([])
        };
        if (jCond_spec.numChildren > 0) {
            jCond = jCond_spec.jCondTranslator[0];
        }
        var decl = declarator.jamCTranslator;
        var funcname = decl.name;
        var currentFunction = funcname;

        symbolTable.enterScope();
        callGraph.addActivity('c', currentFunction, "sync");
        var params = decl.params;
        for (var i = 0; i < params.length; i++) {
            if (params[i].type === "jamtask") {
                throw "jamtask cannot be used in synchronous activity " + funcname;
            }
            c_codes.push(types.getCCode(params[i].type));
            symbolTable.set(params[i].name, params[i].type);
        }
        symbolTable.addActivity(funcname, {
            activityType: "sync",
            language: "c",
            codes: c_codes
        });

        var rtype = specs.cTranslator;
        if (decl.pointer !== '') {
            rtype += decl.pointer;
        }
        var namespc;
        if (namespace.numChildren > 0) {
            namespc = namespace.jamCTranslator;
        }

        var js_output = activities.CreateCSyncJSFunction(funcname, jCond, params);
        var c_output = activities.CreateCSyncCFunction(rtype, funcname, params, stmt.cTranslator);

        symbolTable.exitScope();

        return {
            C: c_output,
            JS: js_output.JS,
            annotated_JS: js_output.annotated_JS
        };
    },
    Async_activity: function(_, jCond_spec, decl, namespace, stmt) {
        var c_codes = [];
        var jCond = {
            source: "true",
            code: 0,
            cback: "",
            bcasts: JSON.stringify([])
        };
        if (jCond_spec.numChildren > 0) {
            jCond = jCond_spec.jCondTranslator[0];
        }
        var funcname = decl.jamCTranslator.name;
        symbolTable.enterScope();
        currentFunction = funcname;
        callGraph.addActivity('c', currentFunction, "async");
        var params = decl.jamCTranslator.params;
        for (var i = 0; i < params.length; i++) {
            symbolTable.set(params[i].name, params[i].type);
            c_codes.push(types.getCCode(params[i].type));
        }
        symbolTable.addActivity(funcname, {
            activityType: "async",
            language: "c",
            codes: c_codes
        });
        if (namespace.numChildren > 0) {
            // TODO: Determine the expected behavior when there is at least one namespace
            // funcname = namespc + "_func_" + namespace_funcs[namespc].indexOf(funcname);
        }

        var js_output = activities.CreateCASyncJSFunction(funcname, jCond, params);
        var c_output = activities.CreateCASyncCFunction(funcname, params, stmt.cTranslator);
        symbolTable.exitScope();

        return {
            C: c_output,
            JS: js_output.JS,
            annotated_JS: js_output.annotated_JS
        };
    },
    Activity_def: function(node) {
        return node.jamCTranslator;
    },
    Source: function(decls) {
        var cout = "";
        var jsout = "";
        var annotated_JS = "";

        for (var i = 0; i < decls.numChildren; i++) {
            if (decls.child(i).child(0).ctorName === "Activity_def") {
                var output = decls.child(i).child(0).jamCTranslator;
                cout += output.C + '\n';
                jsout += output.JS + '\n';
                annotated_JS += output.annotated_JS + '\n';
            } else if (decls.child(i).child(0).ctorName === "Prototype") {
                if (decls.child(i).child(0).sourceString === "int main();") {
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

        return {
            'C': cout,
            'JS': jsout,
            'annotated_JS': annotated_JS
        };
    },
    Prototype: function(specs, pointer, id, _1, params, _2, gcc, _3) {
        var rtype = specs.cTranslator;
        if (pointer.numChildren > 0) {
            rtype += pointer.cTranslator;
        }

        var parameters = [];
        if (params.numChildren > 0) {
            var tempParams = params.jamCTranslator[0];
            for (var i = 0; i < tempParams.length; i++) {
                if (tempParams[i].hasOwnProperty("type")) {
                    parameters.push(tempParams[i].type);
                } else {
                    parameters.push(tempParams[i]);
                }
            }
        }

        prototypes.set(id.cTranslator, {
            return_type: rtype,
            params: parameters
        });

        var c_output = "";

        if (symbolTable.activities.js.has(id.cTranslator)) {
            var activity = symbolTable.activities.js.get(id.cTranslator);
            var jParams = activity.jsParams;
            var block = activity.block;
            var jCond = activity.jCond;

            var js_codes = [];
            for (var i = 0; i < parameters.length; i++) {
                if (typeof(parameters[i]) === 'object')
                    js_codes.push(types.getJSCode(parameters[i].type));
                else
                    js_codes.push(types.getJSCode(parameters[i]));

            }

            if (activity.activityType === "sync") {
                // Sync
                for (var i = 0; i < parameters.length; i++) {
                    if (parameters[i] === "jamtask") {
                        throw "jamtask cannot be used in synchronous activity " + id.cTranslator;
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
        var params = [];
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
        };
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
        };
    },
    Dir_declarator: function(node) {
        return node.jamCTranslator;
    },
    Param_decl: function(node) {
        return node.jamCTranslator;
    },
    Param_decl_Declarator: function(decl_specs, decl) {
        var varType = decl_specs.cTranslator;
        if (decl.jamCTranslator.pointer !== '') {
            varType += decl.jamCTranslator.pointer;
        }
        return {
            type: varType,
            name: decl.jamCTranslator.name
        };
    },
    Struct_access: function(id, _, expr) {
        // Remove first character from id (the dot)
        return {
            name: id.sourceString.substr(1),
            value: expr.jamCTranslator
        };
    },
    _nonterminal: function(children) {
        var flatChildren = flattenIterNodes(children).sort(compareByInterval);
        var childResults = flatChildren.map(function(n) {
            return n.jamCTranslator;
        });
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
};

// TODO: When compiling, how do we know if something can be saved to a broadcaster???
// cTranslator.Assign_expr_assign = function(left, op, right) {
//   var symbol = symbolTable.get(left.cTranslator);
//   if(symbol !== undefined) {
//     if(symbol.jdata_type === "broadcaster" ) {
//         throw 'Cannot save to broadcaster ' + left.cTranslator;
//     }
//   }
//   return left.cTranslator + ' ' + op.sourceString + ' ' + right.cTranslator;
// }

cTranslator.Dir_declarator_Id = function(id) {
    var symbol = symbolTable.get(id.sourceString);
    if (symbol !== undefined) {
        if (symbol.jdata_type === "broadcaster") {
            throw 'Variable ' + id.sourceString + ' is conflicting with a prior declaration';
        }
    }
    return id.sourceString;
};

cTranslator.Left_expr_Call = function(left, params) {
    var paramString;

    if (prototypes.has(left.cTranslator)) {
        var paramArray = [];
        var prototypeParams = prototypes.get(left.cTranslator).params;
        for (var i = 0; i < prototypeParams.length; i++) {
            if (prototypeParams[i] === "jamtask") {
                // What is the expected behavior of jamtask????
                // TODO //
                // var jcallbackName = params.child(1).asIteration().child(i).sourceString;
                // symbolTable.addActivity(jcallbackName, {
                //     codes: ["s"],
                //     activityType: "async",
                //     language: "c"
                // });
                // cCallbackActivities.add(jcallbackName);
                // paramArray.push('"' + jcallbackName + '"');
            } else {
                paramArray.push(params.child(1).asIteration().child(i).sourceString);
            }
        }
        paramString = '(' + paramArray.join(', ') + ')';
    } else if (symbolTable.has(left.cTranslator) && symbolTable.get(left.cTranslator) === "jamtask") {
        var cout = '{\njact = jam_create_activity(js);\n';
        cout += 'jam_rexec_async(js, jact, "true", 0, ' + left.cTranslator +
            ', "%s", ' + params.cTranslator.substring(1, params.cTranslator.length - 1) + ');\n';
        cout += 'activity_free(jact);\n}\n';
        return cout;
    } else {
        paramString = params.cTranslator;
    }
    var res = symbolTable.get(left.cTranslator);
    if (res !== undefined && (res === "function" || res.type === "activity")) {
        callGraph.addCall('c', currentFunction, left.cTranslator, params.cTranslator);
    }
    return left.cTranslator + paramString;
};

cTranslator.Primary_expr = function(node) {
    if (node.ctorName === "id") {
        var symbol = symbolTable.get(node.sourceString);
        if (symbol !== undefined && symbol.type === "jdata") {
            if (symbol.jdata_type === "logger" || symbol.jdata_type === "shuffler") {
                throw 'Cannot read values from ' + symbol.jdata_type + ' ' + node.sourceString;
            } else if (symbol.jdata_type === "broadcaster") {
                return `${types.getStringCast(symbol.type_spec)}(get_bcast_next_value(${node.sourceString}))`;
            }
        }
    }
    return node.cTranslator;
};

cTranslator.Assign_stmt_Struct = function(id, _1, _2, members, _3, _4) {
    var symbol = symbolTable.get(id.sourceString);
    if (symbol !== undefined && symbol.type === "jdata") {
        var assignmentMap = new Map();
        if (members.child(0).ctorName == "NonemptyListOf") {
            var list = members.child(0);
            var first = list.child(0).jamCTranslator;
            var rest = list.child(2);
            assignmentMap.set(first.name, first.value);

            for (var i = 0; i < rest.numChildren; i++) {
                var child = rest.child(i).jamCTranslator;
                assignmentMap.set(child.name, child.value);
            }
            var structCall = jdata.createStructCallParams(symbol.type_spec.entries, '', assignmentMap);
            return `jamdata_log_to_server("global", "${id.sourceString}", "${structCall.formatString}", ${structCall.valueArray.join(", ")});`;
        }
    } else {
        return id.sourceString + ' = ' + members.cTranslator + ';';
    }
};

cTranslator.Assign_stmt_Expr = function(id, _1, expr, _2) {
    var symbol = symbolTable.get(id.sourceString);
    if (symbol !== undefined && symbol.type === "jdata") {
        return jdata.createJdataCall("global", id.sourceString, expr.cTranslator, symbol.jdata_type, symbol.type_spec);
    } else {
        var rhs = symbolTable.get(expr.sourceString);
        if (rhs !== undefined && rhs.type === "jdata") {
            if (rhs.type_spec instanceof Object) {
                var res = jdata.createStructDecode(rhs.type_spec.name, rhs.type_spec.entries, '');
                return `jamdata_decode("${res.formatString}", get_bcast_next_value(${expr.sourceString}), ${res.count}, &${id.sourceString}, ${res.offsetArray.join(', ')});\n`;
            }
        }
    }
    return id.sourceString + ' = ' + expr.cTranslator + ';';
};

function broadcasterStruct(struct) {
    var count = 0;
    var offsets = [];

    return {
        count: count,
        offsets: offsets.join(",")
    };
}

cTranslator.Function_def = function(specs, decl, stmts) {
    var declaration = '';
    var fname = '';
    var params = [];

    // Get function params
    fname = decl.child(1).child(0).child(0).cTranslator;
    params = decl.child(1).child(0).child(1).child(0).child(1).cTranslator.split(', ');
    declaration = decl.cTranslator;

    if (fname === "main") {
        fname = "user_main";
        declaration = "user_" + declaration;
    }

    symbolTable.addFunction(fname, 'c');
    currentFunction = fname;
    callGraph.addFunction('c', fname);
    symbolTable.enterScope();
    params.forEach(function(param) {
        var index = param.lastIndexOf(' ');
        symbolTable.set(param.substring(index + 1), param.substring(0, index));
    }, this);
    var cout = specs.cTranslator + " " + declaration + " " + stmts.cTranslator;
    symbolTable.exitScope();
    return cout;
};


function isUndefined(x) {
    return x === void 0;
}

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
    if (list.child(0).ctorName === "NonemptyListOf") {
        return parseNonEmptyList(list.child(0), sep);
    } else {
        return "";
    }
}

function parseNonEmptyList(list, sep) {
    var code = list.child(0).jamCTranslator;
    var rest = list.child(2);
    for (var i = 0; i < rest.numChildren; i++) {
        code += sep + rest.child(i).jamCTranslator;
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
    for (const [name, values] of symbolTable.activities.c) {
        cout += 'activity_regcallback(js->atable, "' + name + '", ' + values.activityType.toUpperCase() + ', "' + values.codes.join('') + '", call' + name + ');\n';
    }
    return cout;
}

function generate_jam_run_app() {
    var cout = `\nvoid jam_run_app(void *arg) {\n
          comboptr_t *cptr = (comboptr_t *)arg; \n`;
    cout += 'user_main(cptr->iarg, (char **)cptr->argv);\n';
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
    int argoff = jamargs(argc, argv, app_id, dev_tag, &ndevices);
    argc = argc - argoff;
    argv = &(argv[argoff]);
    comboptr_t *cptr = create_combo3ip_ptr(NULL, NULL, NULL, argc, (void **)argv);

    js = jam_init(ndevices);

    user_setup();

    taskcreate(jam_event_loop, js, 50000);
    taskcreate(jam_run_app, cptr, 50000);
  }\n`;
    return cout;
}

var jamc = fs.readFileSync(path.join(__dirname, 'jamc.ohm'));
var ns = {
    C: ohm.grammar(fs.readFileSync(path.join(__dirname, '../c/c.ohm')))
};
var jamCGrammar = ohm.grammar(jamc, ns);
var semantics = jamCGrammar.createSemantics();

semantics.addAttribute('jamCTranslator', jamCTranslator);
semantics.addAttribute('cTranslator', cTranslator);
semantics.addAttribute('jCondTranslator', jCondTranslator.jCondTranslator);

function translate(tree) {
    var results = semantics(tree).jamCTranslator;
    var cout = "";
    cout += 'jamstate_t *js;\n';
    cout += 'int jam_error = 0;\n';
    cout += 'jactivity_t *jact;\n';
    cout += 'typedef char* jamtask;\n';
    cout += 'char jdata_buffer[20];\n';
    cout += 'char app_id[64] = { 0 };\n';
    cout += 'char dev_tag[32] = { 0 };\n';
    cout += 'int ndevices;\n';
    cout += jdata.createCVariables(symbolTable.getGlobals());
    cout += results.C;
    cout += generate_c_activity_wrappers();
    cout += generate_setup();
    cout += generate_jam_run_app();
    cout += generate_taskmain();

    results.C = cout;

    var jsout = activities.generateJSActivities(symbolTable.activities.js);
    results.JS += jsout.JS;
    results.annotated_JS += jsout.annotated_JS;

    var mbox = activities.generateMbox(symbolTable.activities.js);
    results.JS = mbox + results.JS;
    results.annotated_JS += mbox;

    return results;
}

function offsetNumber(numMatch, offset) {
    return (parseInt(numMatch) - offset);
}

function formatErrorMessage(err, offset) {
    var num = new RegExp('[0-9]+');
    var linePat = new RegExp('Line [0-9]+', 'i');
    var linePat2 = new RegExp('[0-9]+ \|', 'g');

    err = err.replace(linePat, function(match) {
        return match.replace(num, function(numMatch) {
            return offsetNumber(numMatch, offset);
        });
    });
  
    err = err.replace(linePat2, function(match) {
        return match.replace(num, function(numMatch){
            return offsetNumber(numMatch, offset);
        })
    });

    return err;
}

module.exports = {
    compile: function(input, offset) {
        console.log("Parsing C Files...");
        var cTree = jamCGrammar.match(input, 'Source');
        if (cTree.failed()) {
            throw formatErrorMessage(cTree.message, offset);
        }
        console.log("Generating C code...");
        return translate(cTree);
    }
};
