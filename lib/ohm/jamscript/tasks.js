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
    createCTaskWrapperInC: function(ctask) {
        let cOut = astify(`void wrapper_${ctask.name}(context_t ctx) {}`, 'Function_def');
        // if (types.checkNeedsBuffer(returnType))
        //     cOut.decl.params.append(astify(`${types.getCType(returnType)} buf`, "Param_decl"));
        let body = [];
        body.append(astify('(void)ctx;', "Stmt"));
        body.append(astify('arg_t* t = (arg_t*)(task_get_args());', "Stmt"));
        let args = ctask.params.map((type, index) => `t[${index}].val.${types.get(type).jamlib}`);
        let funcCall = `${ctask.name}(${args})`;
        if (!ctask.return_type) {
            body.append(astify(`${funcCall};`, "Stmt"));
        } else {
            let retType = c.types.get(ctask.return_type);
            body.append(astify('arg_t retarg;', "Stmt"));
            body.append(astify(`retarg.type = ${retType.c_enum};`, "Stmt"));
            body.append(astify('retarg.nargs = 1;', "Stmt"));
            if (ctask.return_type.type === "Jamtype_return_Void")
                body.append(astify(`${funcCall};`, "Stmt"));
            else if (ctask.return_type.type === "Jamtype_return_Array")
                body.append(astify(`retarg.val.${retType.jamlib} = nvoid_dup((nvoid_t*)${funcCall});`, "Stmt"));
            else
                body.append(astify(`retarg.val.${retType.jamlib} = ${funcCall};`, "Stmt"));
            // TODO... we don't know whether a string we get as a return type was dynamically or statically allocatd
            // if (returnType === "string") // TODO... shouldn't this already be allocated anyways?
            //     funCall.expr = {type: "Funcall_expr",
            //                     name: {type: "id", name: "strdup"},
            //                     args: [funCall.expr]};
            body.append(astify('mco_push(mco_running(), &retarg, sizeof(arg_t));', "ExprStmt"));
        }
        body.append(astify('command_args_free(t);', "ExprStmt"));
        cOut.body.body = body;
        return cOut;
    },
    createJsTaskWrapperInC: function(jtask) {
        let cOut = astify(`${returnType} ${name}() {}`, "Function_def");
        cout.decl.params = functionParams.map((type, index) =>
            astify(`${types.get(type).c_type} arg_${index}`, "Param_decl"));

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
