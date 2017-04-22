var types = require('./types');

module.exports = {
  CreateCASyncJSFunction: function (fname, jCond, params) {
    var ps = [];
    params.forEach(function (p) {
      ps.push(p.name);
    });
    var funccode = "function " + fname + "(" + ps.join(',') + ") {\n";

    for (var i = 0; i < ps.length; i++) {
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
  },
  CreateCASyncCFunction: function (dspec, fname, params, stmt) {
    var cout = "";
    var typed_params = [];
    params.forEach(function (p) {
      typed_params.push(p.type + ' ' + p.name);
    });

    // Main function
    cout += 'void ' + fname + '(' + typed_params.join(", ") + ')' + stmt + '\n';

    // Calling function
    cout += 'void call' + fname + '(void *act, void *arg) {\n';
    cout += 'command_t *cmd = (command_t *)arg;\n';
    cout += fname + '(';
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
  CreateCSyncJSFunction: function (fname, jCond, params) {
    var ps = [];
    params.forEach(function (p) {
      ps.push(p.name);
    });

    var funccode = "function " + fname + "(" + ps.join(',') + ") {\n";

    // write the code that would call the remote function
    funccode += `return deasync(jnode.remoteSyncExec)("${fname}", [ ${ps.join(',')} ], "${jCond.source}", ${jCond.code});\n`;

    // write the end of the function
    funccode += "}\n";

    return {
      JS: funccode,
      annotated_JS: funccode
    }
  },
  CreateCSyncCFunction: function (dspec, fname, params, stmt) {
    var cout = "";
    var typed_params = [];
    params.forEach(function (p) {
      typed_params.push(p.type + ' ' + p.name);
    });

    // Main function
    cout += dspec + ' ' + fname + '(' + typed_params.join(", ") + ')' + stmt + '\n';

    // Calling function
    cout += 'void call' + fname + '(void *act, void *arg) {\n';
    cout += 'command_t *cmd = (command_t *)arg;\n';

    var funcCall = fname + '(';
    for (var i = 0; i < params.length; i++) {
      funcCall += 'cmd->args[' + i + '].val.' + types.getJamlibCode(params[i].type)
      if (i < params.length - 1) {
        cout += ', ';
      }
    }
    funcCall += ')';

    if (dspec !== 'void') {
      cout += 'activity_complete(js->atable, cmd->actid, "' + types.getCCode(dspec) + '", ' + funcCall + ');\n';
    } else {
      cout += funcCall + ';\n';
      cout += 'activity_complete(js->atable, cmd->actid, "");\n';
    }
    cout += '}\n';

    return cout;
  },
  CreateJSASyncJSFunction: function (fname, cParams, jParams, stmt) {
    var ps = [];
    var annotated_ps = [];

    for (var i = 0; i < cParams.length; i++) {
      if (cParams[i] === "jcallback") {
        stmt = `${jParams[i]} = function(x) { jnode.remoteAsyncExec(_${i}, [x], "true", 0); }\n` + stmt;
        ps.push("_" + i);
        annotated_ps.push("_" + i + ':' + types.getJSCode(cParams[i]));
      } else {
        ps.push(jParams[i]);
        if (typeof (cParams[i]) === 'object')
          annotated_ps.push(jParams[i] + ':' + types.getJSCode(cParams[i].type));
        else
          annotated_ps.push(jParams[i] + ':' + types.getJSCode(cParams[i]));
      }
    }

    var jsout = "function call" + fname + "(" + ps.join(',') + ") {\n" + stmt + "\n}\n";
    var annotated_jsout = "function call" + fname + "(" + annotated_ps.join(',') + "): void {\n" + stmt + "\n}\n";

    return {
      JS: jsout,
      annotated_JS: annotated_jsout
    };
  },
  CreateJSASyncCFunction: function (fname, cParams, jParams, jCond) {
    var ps = [], qs = [], c_codes = [];

    for (var i = 0; i < cParams.length; i++) {
      qs.push(jParams[i]);
      if (typeof (cParams[i]) === 'object') {
        c_codes.push(types.getCCode(cParams[i].type));
        ps.push(cParams[i].type + ' ' + jParams[i]);
      }
      else {
        c_codes.push(types.getCCode(cParams[i]));
        ps.push(cParams[i] + ' ' + jParams[i]);
      }
    }

    var cout = "jactivity_t *" + fname + "(" + ps.join(', ') + ") {\n";
    cout += 'jactivity_t *jact = jam_create_activity(js);\n';
    cout += `jactivity_t *res = jam_rexec_async(js, jact, "${jCond.source}", ${jCond.code}, "${fname}", "${c_codes.join('')}"`;
    if (qs.length > 0) {
      cout += ',' + qs.join(', ');
    }
    cout += ');\n';
    cout += 'activity_free(jact);\n';

    cout += 'return res;\n';
    cout += '}\n';

    return cout;
  },
  CreateJSSyncJSFunction: function (rtype, fname, cParams, jParams, stmt) {
    var ps = [];
    var annotated_ps = [];
    for (var i = 0; i < cParams.length; i++) {
      ps.push(jParams[i]);
      var typeName;
      if (typeof (cParams[i]) === 'object') {
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

    var jsout = "function call" + fname + "(" + ps.join(',') + ") {\n" + stmt + "\n}\n";
    var annotated_jsout = "function call" + fname + "(" + annotated_ps.join(',') + "):" + js_return_type + " {\n" + stmt + "\n}\n";

    return {
      JS: jsout,
      annotated_JS: annotated_jsout
    };
  },
  CreateJSSyncCFunction: function (dspec, fname, cParams, jParams, jCond) {
    var ps = [], qs = [];
    var c_codes = [];

    for (var i = 0; i < cParams.length; i++) {
      var typeName;
      if (typeof (cParams[i]) === 'object') {
        typeName = cParams[i].type;
      } else {
        typeName = cParams[i];
      }
      ps.push(typeName + ' ' + jParams[i]);
      qs.push(jParams[i]);
      c_codes.push(types.getCCode(typeName));
    }

    var cout = dspec + " " + fname + "(" + ps.join(', ') + ") {\n";
    cout += `arg_t *res = jam_rexec_sync(js, "${jCond.source}", ${jCond.code}, "${fname}", "${c_codes.join('')}"`;
    if (qs.length > 0) {
      cout += ',' + qs.join(', ');
    }
    cout += ');\n';

    if (dspec === 'void') {
      cout += 'command_arg_free(res);\n'
      cout += 'return;\n';
    } else {
      var retval = 'res->val.' + types.getJamlibCode(dspec);
      if (dspec === 'char*') {
        retval = 'strdup(' + retval + ')';
      }
      cout += dspec + ' ret = ' + retval + ';\n';
      cout += 'command_arg_free(res);\n'
      cout += 'return ret;\n';
    }
    cout += '}\n';

    return cout;
  },
  CreateJSAsyncMachFunction: function (fname, jCond, params) {
    var jsout = "function " + fname + "(" + params.join(',') + ") {\n";

    for (var i = 0; i < params.length; i++) {
      jsout += `if(typeof ${params[i]} === "function") { ${params[i]} = ${params[i]}.name; }\n`;
    }

    jsout += `jnode.machAsyncExec("${fname}", [ ${params.join(',')} ], "${jCond.source}", ${jCond.code});\n`;
    jsout += "}\n";

    return jsout;
  },
  CreateJSSyncMachFunction: function (fname, jCond, params) {
    var jsout = "function " + fname + "(" + params.join(',') + ") {\n";
    jsout += `return deasync(jnode.machSyncExec)("${fname}", [ ${params.join(',')} ], "${jCond.source}", ${jCond.code});\n`;
    jsout += "}\n";

    return jsout;
  },
  generateJSActivities: function (jsActivities) {
    var jsOut = "";
    var annotatedJSOut = "";
    for (const [name, data] of jsActivities) {
      if (data.cParams === undefined) {
        var result = "function call" + name + "(" + data.jsParams.join(',') + ") {\n" + data.block + "\n}\n";
        jsOut += result;
        annotatedJSOut += result;
      } else {
        var result;
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
    }
  }

}