const types = require('./types');
const astify = require('./cAstMatcher').astify;

module.exports = {
    generateMbox: function(jsTasks, inJStart=false) {
        return `
        const mbox = new Map();

        ${Array.from(jsTasks.keys()).map(functionName => {
            const {jCond, signature, taskType} = jsTasks.get(functionName);
            const resultsDescriptor = taskType === 'async' ? 'false' : 'true';
            return `mbox.set("${functionName}", {func: ${inJStart ? '"' : ''}${functionName}${inJStart ? '"' : ''}, arg_sig: "${signature}", side_eff: true, results: ${resultsDescriptor}, reuse: false, cond: "${jCond.tag ? jCond.tag : ''}"});`
        }).join('\n')}
        `;
    },
    createCTaskWrapperInC: function(cTask) {
        let cOut = astify(`void call_${functionName}(context_t ctx) {}`, 'Function_def');
        // if (types.checkNeedsBuffer(returnType))
        //     cOut.decl.params.append(astify(`${types.getCType(returnType)} buf`, "Param_decl"));
        let body = [];
        body.append(astify('(void)ctx;', "Stmt"));
        body.append(astify('arg_t* t = (arg_t*)(task_get_args());', "Stmt"));
        let args = functionParams.map((type, index) => `t[${index}].val.${types.getJamlibCode(type)}`);
        let funcCall = `${functionName}(${args})`;
        funcCall.expr.args = args;
        if (returnType === 'void') {
            body.append(funcCall);
        } else {
            let retArgType = c.types.getCEnum(returnType);
            body.append(astify('arg_t retarg;', "Stmt"));
            body.append(astify(`retarg.type = ${retArgType};`, "Stmt"));
            body.append(astify('retarg.nargs = 1;', "Stmt"));
            if (returnType === "nvoid") { // TODO this isn't actually a type lol!!
                // TODO duplicate nvoids
            } else
                let callStmt = astify(`retarg.val.${types.getJamlibCode(returnType)} = ${funcCall};`, "Stmt");
            // TODO... we don't know whether a string we get as a return type was dynamically or statically allocated
            // if (returnType === "string") // TODO... shouldn't this already be allocated anyways?
            //     funCall.expr = {type: "Funcall_expr",
            //                     name: {type: "id", name: "strdup"},
            //                     args: [funCall.expr]};

            body.append(callStmt);
            body.append(astify('mco_push(mco_running(), &retarg, sizeof(arg_t));', "ExprStmt"));
            body.append(astify('command_args_free(t);', "ExprStmt"));
        }
        cOut.body.body = body;
        return cOut;
    },
    createJsTaskWrapperInC: function(returnType, name, functionParams) {
        let cOut = astify(`${returnType} ${name}() {}`, "Function_def");
        cout.decl.params = functionParams.map((type, index) =>
            astify(`${types.getCType(type)} arg_${index}`, "Param_decl"));

        const argsig = functionParams.map(type => types.getCCode(type)).join(''); // TODO this should be a pass
        const args = functionParams.map((_, index) => `arg_${index}`).join();
        let body = [];
        // TODO this could be async??
        let callExpr = `remote_sync_call(cnode->tboard, "${name}", "${argsig}", ${args})`; // TODO this is wrong

        if (returnType === 'void') {
            body.append(astify(`bool res = ${callExpr};`, "Decl"));
            body.append(astify(`if(!res) {printf("ERROR! Remote execution error in ${name}\\n");}`, "Stmt"));
        } else {
            body.append(astify(`arg_t* a = ${callExpr};`, "Decl"));
            let val = `a->val.${types.getJamlibCode(returnType)}`;
			if (returnType === 'string') // TODO would be nice to have this passed in
				body.append(astify(`${returnType} rval=strdup(${val});`, "Decl"));
		    else
				body.append(astify(`${returnType} rval=${val};`, "Decl"));
            body.append(astify(`command_args_free(a);`, "Stmt"));
            body.append(astify(`return rval;`, "Stmt"));
        }
        cOut.body.body = body;
        return cOut;
    },
    createArgsig: {
        Async_task: function(node) {
            return this.walk(node.params).join("");
        },
        Sync_task: function(node) {
            return this.walk(node.params).join("");
        },
        Jamparam_decl: function(node) {
            if (node.array)
                return "n";
            return this.walk(node.type);
        },
        Jamtype: function(node) {
            return types.getCCode(node.name);
        }
    },
};
