/* eslint-env node */

'use strict';

var fs = require('fs');
var path = require('path');

var ohm = require('ohm-js');
var es5Translator = {};
var es6 = require('../ecmascript/es6');

var jCondTranslator = require('./jCondTranslator');
var symbolTable = require('./symbolTable');
var callGraph = require('./callGraph');
var jdata = require('./jdata');
var activities = require('./activities');

var currentFunction = "";
var memberFunc = undefined;
var flowDecls = new Map();
var maxLevel = 1;

var jamJSTranslator = {
    Program: function(directives, elements) {
        var jsout = "";
        var annotated_JS = "";
        var hasJdata = false;

        callGraph.addFunction('js', 'root');
        currentFunction = "root";
        for (var i = 0; i < elements.children.length; i++) {
            if (elements.child(i).child(0).child(0).ctorName === "Activity_def") {
                jsout += elements.child(i).child(0).child(0).jamJSTranslator;
            } else if (elements.child(i).child(0).child(0).ctorName === "Jconditional") {
                jsout += elements.child(i).child(0).child(0).jamJSTranslator;
            } else if (elements.child(i).child(0).child(0).ctorName === "Jdata_decl") {
                hasJdata = true;
                jsout += elements.child(i).child(0).child(0).jamJSTranslator;
            } else {
                currentFunction = "root";
                jsout += elements.child(i).child(0).child(0).es5Translator + '\n';
            }
        }

        var requires = '';
        requires += "const Worker = require('tiny-worker');\n";
        requires += "const jworklib = require('jamserver/jworklib');\n";
        if (hasJdata) {
            requires += "const JAMManager = require('jamserver/jammanager');\n";
            requires += "const JAMLogger = require('jamserver/jamlogger');\n";
            requires += "const JAMBroadcaster = require('jamserver/jambroadcaster');\n";
        }
        requires += "var jsys;\n";
        requires += "var jman;\n";

        annotated_JS = requires + annotated_JS;

        return {
            'JS': {requires: requires, jsout: jsout},
            'annotated_JS': annotated_JS,
            'maxLevel': maxLevel,
            'hasJdata': hasJdata
        };
    },
    Activity_def: function(node) {
        return node.jamJSTranslator;
    },
    jdata_type: function(type) {
        return type.sourceString;
    },
    Jdata_spec_specified: function(type_spec, id, _1, jdata_type, _2, level, _3, _4) {
        symbolTable.set(id.sourceString, {
            type: "jdata",
            type_spec: type_spec.jamJSTranslator,
            jdata_type: jdata_type.jamJSTranslator
        });
        if (jdata_type.jamJSTranslator === 'logger') {
            return `var ${id.sourceString} = new JAMLogger(jman, "${id.sourceString}");\njworklib.addLogger("${id.sourceString}", ${id.sourceString}.getMyDataStream());`;
        } else if (jdata_type.jamJSTranslator === 'broadcaster') {
            return `var ${id.sourceString} = new JAMBroadcaster('${id.sourceString}', jman);\njworklib.addBroadcaster("${id.sourceString}", ${id.sourceString});`;
        } else if (jdata_type.jamJSTranslator === 'shuffler') {
            return `var ${id.sourceString} = new JAMShuffler('${id.sourceString}', jman);\njworklib.addJAMShuffler("${id.sourceString}", ${id.sourceString});`;
        } else {
            return;
        }
    },
    Jdata_spec_default: function(type_spec, id, _1, jdata_type, _2) {
        symbolTable.set(id.sourceString, {
            type: "jdata",
            type_spec: type_spec.jamJSTranslator,
            jdata_type: jdata_type.jamJSTranslator
        });

        if (jdata_type.jamJSTranslator === 'logger') {
            return `var ${id.sourceString} = new JAMLogger(jman, "${id.sourceString}");\njworklib.addLogger("${id.sourceString}", ${id.sourceString}.getMyDataStream());`;
        } else if (jdata_type.jamJSTranslator === 'broadcaster') {
            return `var ${id.sourceString} = new JAMBroadcaster('${id.sourceString}', jman);\njworklib.addBroadcaster("${id.sourceString}", ${id.sourceString});`;
        } else if (jdata_type.jamJSTranslator === 'shuffler') {
            return `var ${id.sourceString} = new JAMShuffler('${id.sourceString}', jman);\njworklib.addShuffler("${id.sourceString}", ${id.sourceString});`;
        } else {
            return;
        }
    },
    Jdata_spec_flow: function(node, _) {
        return node.jamJSTranslator;
    },
    Jdata_spec: function(node) {
        return node.jamJSTranslator;
    },
    Flow_flow: function(id, _1, _2, _3, func, _4, input) {
        return `var ${id.sourceString} = ${func.sourceString}(Flow.from(${input.sourceString}));`;
    },
    Flow_outflow: function(id, _1, _2, _3, input) {
        return `var ${id.sourceString} = new OutFlow(${input.sourceString});`;
    },
    Flow_inflow: function(id, _1, _2) {
        return `var ${id.sourceString} = new InFlow();`;
    },
    Flow: function(node) {
        return node.jamJSTranslator;
    },
    Page_elem: function(elem) {
        return elem.jamJSTranslator;
    },
    Display_elem: function(id, _1, _2, _3, specs, _4) {
        var output = {};
        var jsout = "";
        var refreshRate = 500;
        var jdataSource = "";
        output.dispLabel = id.sourceString;
        specs.jamJSTranslator.forEach(function(element) {
            output[element.name] = element.value;
            if(element.name === "refresh") {
                refreshRate = element.value;
            } else if(element.name === "title") {
                output.name = element.value;
            } else if(element.name === "source") {
                jdataSource = element.value;
                output.store = {
                    socket: {
                        id: element.value,
                        x: "x",
                        y: "y"
                    }
                }
            }
        });
        return {
            js: `var jvc = 0; setInterval(() => {for (i = 0; i < ${jdataSource}.size(); i++) if (${jdataSource}[i] !== undefined && ${jdataSource}[i].lastValue() != null) socket.emit('newDataPoint', {x: jvc++, y: ${jdataSource}[i].lastValue(), gateIndex: 0, id: "${jdataSource}"});}, ${refreshRate});\n`
        };
    },
    Control_elem: function(id, _1, _2, _3, specs, _4) {
        var output = {};
        var outputJS = "";
        output.dispLabel = id.sourceString;
        output.type = "Controller";
        output.store = [{val: 0}];
        specs.jamJSTranslator.forEach(function(element) {
            if(element.name === "type") {
                var controlList = {};
                if(element.value === "slider") {
                    controlList.type = "slider";
                    controlList.max = 100;
                    controlList.min = 0;
                    controlList.step = 10;
                    controlList.value = "val";
                    controlList.valueName = "val";
                    controlList.trigger = "emitValue";
                    controlList.mode = 0
                    controlList.interval = 5000;
                } else if (element.value === "button") {
                    controlList.type = "button";
                    controlList.className = "btn-primary";
                    controlList.value = "val";
                    controlList.valueName = "val";
                    controlList.trigger = "emitValue";
                    controlList.disabled = false;
                    controlList.mode = 0
                    controlList.interval = 5000;
                }
                output.controlList = [controlList];
            } else if(element.name === "title") {
                output.name = element.value;
            } else {
                output[element.name] = element.value;
            }
        });
        output.controlList[0].id = output.sink;
        output.controlList[0].dispLabel = output.sink;
        if(output.controlList[0].type === "button") {
            outputJS = `socket.on('emitValue', (data) => { if(data.id === "${output.sink}") ${output.sink}.broadcast(Number(data.value)); });\n`;
        } else {
            outputJS = `socket.on('emitValue', (data) => { if(data.id === "${output.sink}") ${output.sink}.broadcast(parseInt(data.value)); });\n`;
        }
        return {
            js: outputJS
        };
    },
    Page_name: function(_1, _2, id, _3) {
        return id.sourceString;
    },
    Disp_spec: function(property, _1, value, _2) {
        var valueString = value.sourceString;
        if(value.ctorName === "stringLiteral") {
            valueString = valueString.substring(1, valueString.length-1);
        }
        return {
            name: property.sourceString,
            value: valueString
        };
    },
    Ctrl_spec: function(property, _1, value, _2) {
        var valueString = value.sourceString;
        if(value.ctorName === "stringLiteral") {
            valueString = valueString.substring(1, valueString.length-1);
        }
        return {
            name: property.sourceString,
            value: valueString
        };
    },
    Struct_entry: function(type, id, _) {
        return {
            name: id.sourceString,
            type: type.jamJSTranslator
        };
    },
    C_type_struct: function(_1, id, _2, entries, _3) {
        return {
            name: id.sourceString,
            entries: entries.jamJSTranslator
        };
    },
    C_type_pointer: function(id, pointer) {
        return id.sourceString + "*";
    },
    C_type: function(node) {
        return node.jamJSTranslator;
    },
    Jdata_decl: function(_1, _2, jdata_spec, _3) {
        var output = "";
        var specs = jdata_spec.jamJSTranslator;
        for (var i = 0; i < specs.length; i++) {
            if (specs[i] !== undefined) {
                output += specs[i] + '\n';
            }
        }
        return output;
    },
    MemberExpr_funcExpr: function(fname, _1, node, _2) {
        memberFunc = fname.sourceString;
        var val = node.jamJSTranslator;
        memberFunc = undefined;
        return val;
    },
    MemberExpr_propRefExp: function(left, op, right) {

        var str;
        var funcname = "";
        var flowname;
        var bcaster = [];

        if (left.sourceString === "jsys") {
            return {
                string: left.sourceString + "." + right.sourceString,
                func: funcname,
                bcasts: bcaster
            };
        }
        else if (left.child(0).ctorName === "identifier") {
            var sentry = symbolTable.get(left.sourceString);
            if (sentry === undefined)
                throw (left.sourceString + " is not defined in jdata");
            if (sentry.jdata_type === 'broadcaster' && memberFunc !== undefined)
                throw ("function reduction cannot be applied on broadcasters " + left.child(0).ctorName);
            if (sentry.jdata_type === 'logger'  || sentry.jdata_type === 'shuffler') {
                if (sentry.type_spec === 'char*') {
                    str = "lgg." + left.sourceString + ".lastValue()";
                } else {
                    flowname =  '__' + left.sourceString + 'Flow';
                    funcname += generateFlowDecl(left.sourceString, flowname, right.sourceString);
                    if (memberFunc === undefined)
                        str = writeMemFunc(flowname, right.sourceString, "avg");
                    else
                        str = writeMemFunc(flowname, right.sourceString, memberFunc);
                }
            } else {
                str = "bc." + left.sourceString + ".getLastValue()." + right.sourceString;
                bcaster.push(left.sourceString);
            }
            return {
                string: str,
                func: funcname,
                bcasts: bcaster
            }
        } else {
            throw ("Only first level attributes allowed in jcond: " + left.sourceString + "." + right.sourceString);
        }
    },
    MemberExpr: function(node) {

        var str;
        var funcname = "";
        var flowname;
        var bcaster = [];

        if (node.ctorName === "identifier") {
            var sentry = symbolTable.get(node.sourceString);
            if (sentry === undefined)
                throw (node.sourceString + " is not defined in jdata");

            if (sentry.jdata_type === 'broadcaster' && memberFunc !== undefined)
                throw ("function reduction cannot be applied on broadcasters " + node.sourceString);

            if (sentry.jdata_type === 'logger' || sentry.jdata_type === 'shuffler') {
                if (sentry.type_spec === 'char*') {
                    str = "lgg." + node.sourceString + ".lastValue()";
                } else {
                    flowname =  '__' + node.sourceString + 'Flow';
                    funcname += generateFlowDecl(node.sourceString, flowname, null);
                    if (memberFunc === undefined)
                        str = writeMemFunc(flowname, null, "avg");
                    else
                        str = writeMemFunc(flowname, null, memberFunc);
                }
            } else {
                str = "bc." + node.sourceString + ".getLastValue()";
                bcaster.push(node.sourceString);
            }
            return {
                string: str,
                func: funcname,
                bcasts: bcaster
            }
        } else if (node.ctorName === "literal") {
            return {
                string: node.jamJSTranslator,
                func: "",
                bcasts: bcaster
            }
        } else {
            return {
                string: node.jamJSTranslator.string,
                func: node.jamJSTranslator.func,
                bcasts: node.jamJSTranslator.bcasts
            }
        }
    },
    Jcond_rule: function(left, op, right, _1, cb) {
        var code = 0;
        var cback = "";

        // Set the callback..
        if (cb.numChildren > 0)
            cback = cb.sourceString;

        // Put jsys.type on left hand side, so we don't have to check everything twice
        if (right.sourceString === "jsys.type") {
            if (left.sourceString === "jsys.type") {
                throw "Cannot have jsys.type as both sides of expression";
            } else {
                var temp = right;
                right = left;
                left = temp;
            }
        }
        if (left.sourceString === "jsys.type") {
            if (op.sourceString === "==") {
                if (right.sourceString === '"device"') {
                    code = 1;
                } else if (right.sourceString === '"fog"') {
                    code = 2;
                    maxLevel = Math.max(maxLevel, 2);
                } else if (right.sourceString === '"cloud"') {
                    code = 4;
                    maxLevel = Math.max(maxLevel, 3);
                }
            } else if (op.sourceString === "!=") {
                if (right.sourceString === '"device"') {
                    code = 6;
                } else if (right.sourceString === '"fog"') {
                    code = 5;
                    maxLevel = Math.max(maxLevel, 2);
                } else if (right.sourceString === '"cloud"') {
                    code = 3;
                    maxLevel = Math.max(maxLevel, 3);
                }
            } else {
                throw "Operator " + op.sourceString + " not compatible with jsys.type";
            }
        } else if (left.sourceString === "jsys.sync") {
            if (op.sourceString === ">=" || op.sourceString === "==") {
                if (right.child(0).ctorName === "literal" && Number(right.sourceString) > 0) {
                    code = code | 8;
                }
            }
        } else if (left.child(0).ctorName !== "literal" || right.child(0).ctorName !== "literal") {
            code = code | 16;
        }

        return {
            string: "jcondContext(\"" + left.jamJSTranslator.string + "\") " + op.sourceString + ' ' + right.jamJSTranslator.string,
            code: code,
            cback: cback,
            func: left.jamJSTranslator.func + right.jamJSTranslator.func,
            bcasts: mergeElements(left.jamJSTranslator.bcasts, right.jamJSTranslator.bcasts)
        };
    },
    Jcond_entry: function(id, _1, rules, _2) {
        var first = rules.child(0).jamJSTranslator;
        var seperators = rules.child(1);
        var rest = rules.child(2);
        var code = first.code;
        var string = first.string;
        var funcstr = first.func;
        var cback = [];
        if (first.cback !== '')
            cback = [first.cback];
        var bcasts = first.bcasts;
        for (var i = 0; i < rest.numChildren; i++) {
            var restval = rest.child(i).jamJSTranslator;
            string += ' ' + seperators.child(i).sourceString + ' ' + restval.string;
            code = code | restval.code;
            funcstr += restval.func;
            if (restval.cback !== '')
                cback.push(restval.cback);
            bcasts = mergeElements(bcasts, restval.bcasts);
        }

        return {
            name: id.sourceString,
            string: string,
            code: code,
            func: funcstr,
            cback: cback,
            bcasts: bcasts
        };
    },
    Jconditional: function(_1, id, _2, entries, _3) {
        var output = "";
        var foutput = "\n";
        var namespace = "";
        if (id.numChildren > 0) {
            namespace = id.sourceString + ".";
        }
        for (var i = 0; i < entries.numChildren; i++) {

            var entry = entries.child(i).jamJSTranslator;
            var ecback = entry.cback;

            if (ecback == '')
                ecback = null;
            output += "jworklib.setjcond('" + namespace + entry.name + "', { source: 'eval(" + entry.string + ")', code: " + entry.code + ", cback: " + ecback + ", bcasts: " + JSON.stringify(entry.bcasts) + " });\n";
            foutput += entry.func;
            jCondTranslator.set(namespace + entry.name, {
                source: entry.string,
                code: entry.code
            });
        }
        return output + foutput;
    },
    Sync_activity: function(_, jCond_spec, functionDeclaration) {
        var jCond = {
            source: "true",
            code: 0,
            cback: "",
            bcasts: []
        };
        if (jCond_spec.numChildren > 0) {
            jCond = jCond_spec.jCondTranslator[0];
        }
        var specs = functionDeclaration.jamJSTranslator;
        var rtype;
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
            code: 0,
            cback: "",
            bcasts: JSON.stringify([])
        };
        if (jcond_spec.numChildren > 0) {
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
        };
    },
    FormalParameterList: function(params) {
        var paramArray = [];
        if (params.child(0).ctorName === "NonemptyListOf") {
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
        var childResults = flatChildren.map(function(n) {
            return n.jamJSTranslator;
        });
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
};

es5Translator.AssignmentStatement_expression = function(left, _2, right, _4) {
    var symbol = symbolTable.get(left.es5Translator);

    if (symbol !== undefined) {
        if (symbol.jdata_type === "broadcaster") {
            var value;
            // Convert value to a string
            if (symbol.type_spec === "char*") {
                value = `String(${right.es5Translator})`;
            } else {
                value = `String(Number(${right.es5Translator}))`;
            }
            return `jman.broadcastMessage("${left.es5Translator}", ${value});`;
        } else if (symbol.jdata_type === "logger" || symbol.jdata_type === "shuffler") {
            throw `Cannot write to ${symbol.jdata_type} var ${left.es5Translator} from javascript`;
        }
    }
    return left.es5Translator + ' = ' + right.es5Translator + ';';
};

es5Translator.CallExpression_memberExpExp = function(exp, args) {
    if(exp.sourceString === "require") {
        var moduleName = args.child(1).sourceString.slice(1, -1);;
        try {
            require.resolve(moduleName, {'paths': ['~/__jamruns']});
        } catch (e) {
            if (e instanceof Error && e.code === "MODULE_NOT_FOUND") {
                var child_process = require('child_process');
                child_process.execSync(`npm install ${moduleName}`, {stdio:[0,1,2]});
            } else {
                throw e;
            }
        }
    }
    callGraph.addCall('js', currentFunction, exp.es5Translator, args.es5Translator);
    return exp.es5Translator + args.es5Translator;
};

es5Translator.CallExpression_callExpExp = function(exp, args) {
    if(exp.sourceString === "require") {
        var moduleName = args.child(1).sourceString.slice(1, -1);;
        try {
            require.resolve(moduleName, {'paths': ['~/__jamruns']});
        } catch (e) {
            if (e instanceof Error && e.code === "MODULE_NOT_FOUND") {
                var child_process = require('child_process');
                child_process.execSync(`npm install ${moduleName}`, {stdio:[0,1,2]});
            } else {
                throw e;
            }
        }
    }
    callGraph.addCall('js', currentFunction, exp.es5Translator, args.es5Translator);
    return exp.es5Translator + args.es5Translator;
};

es5Translator.FunctionDeclaration = function(_1, id, _2, params, _3, _4, body, _5) {
    var currentFunction = id.es5Translator;
    if (params.jamJSTranslator.length === 1) {
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
};
es5Translator.FunctionExpression_named = function(_1, id, _2, params, _3, _4, body, _5) {
    currentFunction = id.es5Translator;
    symbolTable.addFunction(currentFunction, 'js');
    callGraph.addFunction('js', currentFunction);
    return `function ${id.es5Translator}(${params.es5Translator}) {\n${body.es5Translator}}`;
};
es5Translator.FunctionExpression_anonymous = function(_1, _2, params, _3, _4, body, _5) {
    currentFunction = "anonymous";
    symbolTable.addFunction(currentFunction, 'js');
    callGraph.addFunction('js', currentFunction);
    return `function (${params.es5Translator}) {\n${body.es5Translator}}`;
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
var jamjs = fs.readFileSync(path.join(__dirname, 'jamjs.ohm'));
var ns = {
    ES5: ohm.grammar(fs.readFileSync(path.join(__dirname, '../ecmascript/es5.ohm')))
};
ns.ES6 = ohm.grammar(fs.readFileSync(path.join(__dirname, '../ecmascript/es6.ohm')), ns);

var jamJSGrammar = ohm.grammar(jamjs, ns);
var semantics = jamJSGrammar.extendSemantics(es6.semantics);

semantics.addAttribute('jamJSTranslator', jamJSTranslator);
semantics.extendAttribute('es5Translator', es5Translator);
semantics.addAttribute('jCondTranslator', jCondTranslator.jCondTranslator);

function translate(tree) {
    return semantics(tree).jamJSTranslator;
}

// Additional support functions added by Mahesh (Nov 2017)

function writeMemFunc(lsrc, rsrc, mfn) {

    var str;
    var endstr = "";
    if (rsrc !== null)
        endstr = "." + rsrc;

    switch (mfn) {
        case 'max':
            str = "fl." + lsrc + ".getMax()" + endstr;
            break;
        case 'min':
            str = "fl." + lsrc + ".getMin()" + endstr;
            break;
        case 'avg':
            str = "fl." + lsrc + ".getAverage()" + endstr;
            break;
        case 'sum':
            str = "fl." + lsrc + ".getSum()" + endstr;
            break;
        default:
            throw ("Unsupported aggregation function in JCond: " + mfn);
    }

    return str;
}


function generateFlowDecl(lsrc, flname, rsrc) {

    var src;
    var ename;
    if (rsrc !== null) {
        ename = rsrc;
        rsrc = '"' + rsrc + '"';
    } else
        ename = "";

    var funcname = flname + 'Func' + ename;
    if (flowDecls.get(funcname) !== undefined)
        return "";
    flowDecls.set(funcname, funcname);

    src = 'var ' + flname + ' =  ' + funcname + '(Flow.from(' + lsrc + '));'
    src += '\n';
    src += "jworklib.addFlow('" + flname + "', " + flname + ");\n";
    src += 'function ' + funcname + '(inputFlow) { \n';
    src += 'return inputFlow.select("data").runningReduce({ \n';
    src += 'min: ' + rsrc + ',\n';
    src += 'max: ' + rsrc + ',\n';
    src += 'sum: ' + rsrc + '\n';
    src += '});\n';
    src += '};\n';

    src += '(function poll(){ if (' + lsrc + '.size() < 1) {\n';
    src += 'console.log("Waiting for logger data ");\n';
    src += 'setTimeout(poll, 1000);\n}\nelse {\n';
    src += flname + '.startPush();\n}\n';
    src += '})();\n';

    return src;
}

function mergeElements(x, y) {

    if (y !== undefined) {
        y.forEach(function(el) {
            if (!x.includes(el))
                x.push(el);
        });
    }

    return x;
}

// This function prints the parse tree of the JS program
// To call this, add "printTree(jsTree._cst);" into the compile function in this file 
function printTree(tree) {
    console.log(tree.ctorName);
    var children = tree.children;
    if (children !== undefined) {
        Object.keys(children).forEach((key) => {
        printTree(children[key]);
    });
    } 
}

// End Additional support functions

module.exports = {
    compile: function(input) {
        console.log("Parsing JS Files...");
        var jsTree = jamJSGrammar.match(input, 'Program');
        if (jsTree.failed()) {
            throw jsTree.message;
        }
        console.log("Generating JavaScript Code...");
        return translate(jsTree);
    }
};
