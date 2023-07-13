const types = require('./types');
const astify = require('./cAstMatcher').astify;

module.exports = {
    generateMbox: function(jsActivities, inJStart=false) {
        return `
        const mbox = new Map();

        ${Array.from(jsActivities.keys()).map(functionName => {
            const {jCond, signature, activityType} = jsActivities.get(functionName);
            const resultsDescriptor = activityType === 'async' ? 'false' : 'true';
            return `mbox.set("${functionName}", {func: ${inJStart ? '"' : ''}${functionName}${inJStart ? '"' : ''}, arg_sig: "${signature}", side_eff: true, results: ${resultsDescriptor}, reuse: false, cond: "${jCond.tag ? jCond.tag : ''}"});`
        }).join('\n')}
        `;
    },
    createCTaskWrapperInC: function(returnType, functionName, functionParams) {
        let cOut = astify(`void call_${functionName}(context_t ctx) {}`, 'Function_def');
        if (types.checkNeedsBuffer(returnType))
            cOut.decl.params.append(astify(`${types.getCType(returnType)} buf`, "Param_decl"));
        cOut.body.body.append(astify('(void)ctx;', "ExprStmt"));
        cOut.body.body.append(astify('arg_t* t = (arg_t*)(task_get_args());', "ExprStmt"));
        let args = functionParams.map((value, index) =>
            astify(`t[${index}].val.${types.getJamlibCode(value.type)}`, "Expr"));
        let funcCall = astify(`${functionName}();`, "ExprStmt");
        funcCall.expr.args = args;
        if (returnType === 'void') {
            cOut.body.body.append(funcCall);
        } else {
            let retArgType = c.types.getCEnum(returnType);
            cOut.body.body.append(astify('arg_t retarg;', "ExprStmt"));
            cOut.body.body.append(astify(`retarg.type = ${retArgType};`, "ExprStmt"));
            cOut.body.body.append(astify('retarg.nargs = 1;', "ExprStmt"));
            let callStmt = astify(`retarg.val.${types.getJamlibCode(returnType)} = 0;`, "ExprStmt");
            callStmt.expr.rhs = funcCall.expr;
            if (returnType === "string"){
                cOut += `retarg.val.sval = strdup(${functionName}(${functionParams.map((value, index) => `t[${index}].val.${types.getJamlibCode(value.type)}`)}));`;
            } else {
                cOut += `retarg.val. = ${functionName}(${functionParams.map((value, index) => `t[${index}].val.${types.getJamlibCode(value.type)}`)});`;
            }
            cOut += 'mco_push(mco_running(), &retarg, sizeof(arg_t));';
            cOut += 'command_args_free(t);';
        }
        return cOut;
    },
    createJsTaskWrapperInC: function(returnType, functionName, functionParamTypes) {
        const functionSignature = functionParamTypes.map(type => types.getCCode(type)).join('');
        const functionParams = functionParamTypes.map((type, index) => {
            return {type: type, name: `arg_${index}`};
        });

        let cOut = '';

        if (returnType === 'void') {
            cOut += `void ${functionName}(${functionParams.map((v) => `${v.type} ${v.name}`).join(',')}){\n`;
            cOut += `bool res=remote_async_call(cnode->tboard,"${functionName}", "${functionSignature}", ${functionParams.map(v => v.name).join(',')});\n`;
            cOut += `if(!res)printf("ERROR! Remote execution error %s\\n", "you");`;
            cOut += `}`;
        } else {
            const returnTypeJamLibCode = types.getJamlibCode(returnType);
            cOut += `${returnType} ${functionName}(${functionParams.map((v) => `${v.type} ${v.name}`).join(',')}){`;
            cOut += `arg_t* a=remote_sync_call(cnode->tboard,"${functionName}", "${functionSignature}", ${functionParams.map(v => v.name).join(',')});`;
			if (returnType === 'char*') {
				cOut += `${returnType} rval=strdup(a->val.${returnTypeJamLibCode});`; // TODO try to fix this memory leak, or responsibility of programmer?
			} else {
				cOut += `${returnType} rval=a->val.${returnTypeJamLibCode};`;
			}
            cOut += `command_args_free(a);`;
            cOut += `return rval;`;
        }

        return cOut;
    }
};
