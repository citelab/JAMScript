var types = require('./types');

module.exports = {
    generateMbox: function(jsActivities, inJStart=false) {
        return `
        const mbox = new Map();

        ${Array.from(jsActivities.keys()).map(functionName => {
            const {jCond, signature, activityType} = jsActivities.get(functionName);
            const resultsDescriptor = activityType === 'async' ? 'false' : 'true';
            return `mbox.set("${functionName}", {func: ${inJStart ? '"' : ''}${functionName}${inJStart ? '"' : ''}, arg_sig: "${signature}", side_eff: true, results: ${resultsDescriptor}, reuse: false, cond: "${jCond && jCond.tag ? jCond.tag : ''}"});`
        }).join('\n')}
        `;
    },
    createCTaskWrapperInC(returnType, functionName, functionParams){
        let cOut = '';
        if (returnType === 'void') {
            cOut += `void call_${functionName}(context_t ctx){\n`;
            cOut += '(void)ctx;\n'
            cOut += 'arg_t *t = (arg_t *)(task_get_args());\n';
            cOut += `${functionName}(${functionParams.map((value, index) => `t[${index}].val.${types.getJamlibCode(value.type)}`)});\n`;
            cOut += '}\n'
        } else {
            let retArgType;
            switch(returnType){
                case 'char*':
                    retArgType = 'STRING_TYPE';
                    break;
                case 'int':
                    retArgType = 'INT_TYPE';
                    break;
                case 'float':
                    retArgType = 'FLOAT_TYPE';
                    break;
                case 'double':
                    retArgType = 'DOUBLE_TYPE';
            }
            cOut += `void call_${functionName}(context_t ctx){\n`;
            cOut += '(void)ctx;\n'
            cOut += 'arg_t *t = (arg_t *)(task_get_args());\n';
            cOut += 'arg_t retarg;\n';
            cOut += `retarg.type = ${retArgType};\n`;
            cOut += 'retarg.nargs = 1;\n';
            if (returnType === "char*"){
                cOut += `retarg.val.sval = strdup(${functionName}(${functionParams.map((value, index) => `t[${index}].val.${types.getJamlibCode(value.type)}`)}));\n`;
            }
            else {
                cOut += `retarg.val.${types.getJamlibCode(returnType)} = ${functionName}(${functionParams.map((value, index) => `t[${index}].val.${types.getJamlibCode(value.type)}`)});\n`;
            }
            cOut += 'mco_push(mco_running(), &retarg, sizeof(arg_t));\n';
            cOut += 'command_args_free(t);\n'
            cOut += '}\n'
        }
        return cOut;
    },
    createJsTaskWrapperInC(returnType, functionName, functionParamTypes) {
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
            cOut += `}`;
        }

        return cOut;
    }
};
