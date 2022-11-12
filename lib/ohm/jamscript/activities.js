var types = require('./types');

module.exports = {
    CreateCASyncJSFunction: function(fname, jCond, params) {
        var ps = [];
        params.forEach(function(p) {
            ps.push(p.name);
        });
        var funccode = "function " + fname + "(" + ps.join(',') + ") {\n";

        for (var i = 0; i < ps.length; i++) {
            funccode += `if(typeof ${ps[i]} === "function") { ${ps[i]} = ${ps[i]}.name; }\n`;
        }

        // write the code that would call the remote function
        funccode += `jworklib.remoteAsyncExec("${fname}", [ ${ps.join(',')} ], "${jCond.source}", ${jCond.code}, "${jCond.bcasts}", "${jCond.cback}");\n`;

        // write the end of the function
        funccode += "}\n";

        return {
            JS: funccode,
            annotated_JS: funccode
        };
    },
    CreateCASyncCFunction: function(fname, params, stmt) {
        var cout = "";
        var typed_params = [];
        var untyped_params = [''];
        params.forEach(function(p) {
            typed_params.push(p.type + ' ' + p.name);
            untyped_params.push(p.name);
        });

        // Main function
        cout += 'void exec' + fname + '(' + typed_params.join(", ") + ')' + stmt + '\n';

        // C Callable function
        cout += 'void ' + fname + '(' + typed_params.join(", ") + ') {\n';
        cout += 'jam_lexec_async(js, "' + fname + '"' + untyped_params.join(', ') + ');\n';
        cout += '}\n';

        // JS Callable function
        cout += 'void call' + fname + '(void *act, void *arg) {\n';
        cout += 'command_t *cmd = (command_t *)arg;\n';
        cout += 'exec' + fname + '(';
        for (var i = 0; i < params.length; i++) {
            cout += 'cmd->args[' + i + '].val.' + types.getJamlibCode(params[i].type);
            if (i < params.length - 1) {
                cout += ', ';
            }
        }
        cout += ');\n';
        cout += '}\n';

        return cout;
    },
    CreateCSyncJSFunction: function(fname, jCond, params) {
        var ps = [];
        params.forEach(function(p) {
            ps.push(p.name);
        });

        var funccode = "function " + fname + "(" + ps.join(',') + ") {\n";

        // write the code that would call the remote function
        funccode += `return jworklib.remoteSyncExec("${fname}", [ ${ps.join(',')} ], "${jCond.source}", ${jCond.code}, "${jCond.bcasts}");\n`;

        // write the end of the function
        funccode += "}\n";

        return {
            JS: funccode,
            annotated_JS: funccode
        };
    },
    CreateCSyncCFunction: function(dspec, fname, params, stmt) {
        var cout = "";
        var typed_params = [];
        params.forEach(function(p) {
            typed_params.push(p.type + ' ' + p.name);
        });

        // Main function
        cout += dspec + ' ' + fname + '(' + typed_params.join(", ") + ')' + stmt + '\n';

        // JS Callable function
        cout += 'void call' + fname + '(void *act, void *arg) {\n';
        cout += 'command_t *cmd = (command_t *)arg;\n';

        var funcCall = fname + '(';
        for (var i = 0; i < params.length; i++) {
            funcCall += 'cmd->args[' + i + '].val.' + types.getJamlibCode(params[i].type);
            if (i < params.length - 1) {
                cout += ', ';
            }
        }
        funcCall += ')';

        if (dspec !== 'void') {
            cout += 'activity_complete(js->atable, strdup(cmd->opt), cmd->actid, "' + types.getCCode(dspec) + '", ' + funcCall + ');\n';
        } else {
            cout += funcCall + ';\n';
            cout += 'activity_complete(js->atable, strdup(cmd->opt), cmd->actid, "");\n';
        }
        cout += '}\n';

        return cout;
    },
    CreateJSASyncJSFunction: function(fname, cParams, jParams, stmt) {
        var ps = [];
        var annotated_ps = [];
        for (var i = 0; i < cParams.length; i++) {
            if (cParams[i] === "jamtask") {
                // TODO //
                // stmt = `${jParams[i]} = function(x) { jworklib.remoteAsyncExecCB(_${i}, [x], "true", 0, [], ""); }\n` + stmt;
                // ps.push("_" + i);
                // annotated_ps.push("_" + i + ':' + types.getJSCode(cParams[i]));
            } else {
                ps.push(jParams[i]);
                if (typeof(cParams[i]) === 'object')
                    annotated_ps.push(jParams[i] + ':' + types.getJSCode(cParams[i].type));
                else
                    annotated_ps.push(jParams[i] + ':' + types.getJSCode(cParams[i]));
            }
        }

        var jsout = "function call" + fname + "(" + ps.join(',') + ") {\n" + stmt + "\njworklib.poplevel();\n}\n";
        var annotated_jsout = "function call" + fname + "(" + annotated_ps.join(',') + "): void {\n" + stmt + "\njworklib.poplevel();\n}\n";

        return {
            JS: jsout,
            annotated_JS: annotated_jsout
        };
    },
    CreateJSSyncJSFunction: function(rtype, fname, cParams, jParams, stmt) {
        var ps = [];
        var annotated_ps = [];
        for (var i = 0; i < cParams.length; i++) {
            ps.push(jParams[i]);
            var typeName;
            if (typeof(cParams[i]) === 'object') {
                typeName = cParams[i].type;
            } else {
                typeName = cParams[i];
            }
            annotated_ps.push(jParams[i] + ':' + types.getJSType(typeName));
        }

        var js_return_type;
        if (rtype === "void") {
            js_return_type = "void";
        } else {
            js_return_type = types.getJSType(rtype);
        }

        var jsout = "function call" + fname + "(" + ps.join(',') + ") {\n" + stmt + "\njworklib.poplevel();\n}\n";
        var annotated_jsout = "function call" + fname + "(" + annotated_ps.join(',') + "):" + js_return_type + " {\n" + stmt + "\njworklib.poplevel();\n}\n";

        return {
            JS: jsout,
            annotated_JS: annotated_jsout
        };
    },
    CreateJSAsyncMachFunction: function(fname, jCond, params) {
        var jsout = "function " + fname + "(" + params.join(',') + ") {\n";

        for (var i = 0; i < params.length; i++) {
            jsout += `if(typeof ${params[i]} === "function") { ${params[i]} = ${params[i]}.name; }\n`;
        }

        jsout += `jworklib.machAsyncExec("${fname}", [ ${params.join(',')} ], "${jCond.source}", ${jCond.code}, "${jCond.bcasts}", "${jCond.cback}");\n`;
        jsout += "}\n";

        return jsout;
    },
    CreateJSSyncMachFunction: function(fname, jCond, params) {
        var jsout = "function " + fname + "(" + params.join(',') + ") {\n";
        jsout += `return jworklib.machSyncExec("${fname}", [ ${params.join(',')} ], "${jCond.source}", ${jCond.code}, "${jCond.bcasts}");\n`;
        jsout += "}\n";
        return jsout;
    },
    generateJSActivities: function(jsActivities) {
        var jsOut = "";
        var annotatedJSOut = "";
        var result;

        for (const [name, data] of jsActivities) {

            if (data.cParams === undefined) {
                result = "function call" + name + "(" + data.jsParams.join(',') + ") {\n" + data.block + "\njworklib.poplevel();\n}\n";
                jsOut += result;
                annotatedJSOut += result;
            } else {
                if (data.activityType === "async") {
                    result = this.CreateJSASyncJSFunction(name, data.cParams, data.jsParams, data.block);
                } else {
                    result = this.CreateJSSyncJSFunction(data.returnType, name, data.cParams, data.jsParams, data.block);
                }
                jsOut += result.JS;
                annotatedJSOut += result.annotated_JS;
            }
        }
        return {
            JS: jsOut,
            annotated_JS: annotatedJSOut
        };
    },
    generateMbox: function(jsActivities) {
        return `
        const mbox = new Map();

        ${Array.from(jsActivities.keys()).map(functionName => {
            const {jCond, signature} = jsActivities.get(functionName);
            return `mbox.set("${functionName}", {arg_sig: "${signature}", side_eff: false, cond: "${jCond.tag ? jCond.tag : ''}"});`
        }).join('\n')}
        `;
    },
    createCTaskWrapper(returnType, functionName, functionParams){
        let cOut = '';
        if (returnType === 'void') {
            cOut += `void call_${functionName}(context_t ctx){\n`;
            cOut += '(void)ctx;\n'
            cOut += 'arg_t *t = (arg_t *)(task_get_args());\n';
            cOut += `${functionName}(${functionParams.map((value, index) => `t[${index}].val.${types.getJamlibCode(value.type)}`)});\n`;
            cOut += '}\n'
        } 
        else {
            let retArgType;
            switch(returnType){
                case 'char*':
                    retArgType = 'STRING_TYPE';
                case 'int':
                    retArgType = 'INTEGER_TYPE';
                case 'float':
                    retArgType = 'FLOAT_TYPE';
                case 'double':
                    retArgType = 'DOUBLE_TYPE';
            } 
            cOut += `void call_${functionName}(context_t ctx){\n`;
            cOut += '(void)ctx;\n'
            cOut += 'arg_t *t = (arg_t *)(task_get_args());\n'; 
            cOut += 'arg_t* retarg = (arg_t*)calloc(1, sizeof(arg_t));\n';
            cOut += `retarg.type = ${retArgType};\n`;
            cOut += 'retarg.nargs = 1;\n';
            cOut += `retarg.val.sval = strdup(${functionName}(${functionParams.map((value, index) => `t[${index}].val.${types.getJamlibCode(value.type)}`)}));\n`;
            cOut += 'mco_push(mco_running(), &retarg, sizeof(arg_t));\n';
            cOut += 'command_arg_inner_free(t);\n'
            cOut += '}\n'
        }
        return cOut;
    }
};
