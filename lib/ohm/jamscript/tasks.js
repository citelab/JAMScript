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
            body.append(astify('command_args_free(t);', "ExprStmt"));
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
            body.append(astify('command_args_free(t);', "ExprStmt"));
            body.append(astify('mco_push(mco_running(), &retarg, sizeof(arg_t));', "ExprStmt"));
        }
        cOut.body.body = body;
        return cOut;
    },
    createJsTaskWrapperInC: function(jtask) {
        let returnType = types.get(jtask.return_type);
        let properType = stringifyType(jtask.return_type);
        let cOut;
        if (jtask.return_type.type === "Jamtype_return_Array") {
            properType = registerArrayType(stringifyType(jtask.return_type.jamtype), jtask.return_type.array);
            cOut = astify(`struct ${properType} ${name}() {}`, "Function_def");
        } else
            cOut = astify(`${properType} ${name}() {}`, "Function_def");
        cout.decl.params = functionParams.map((type, index) =>
            astify(`${types.get(type).c_type} arg_${index}`, "Param_decl"));
        let body = [];
        const argsig = functionParams.map(type => types.get(type).c_code).join(''); // TODO this should be a pass
        const args = functionParams.map((_, index) => `arg_${index}`).join();
        let callArgs = `cnode->tboard, "${name}", "${argsig}", ${args}`;
        if (jtask.type === "Async_task") {
            body.append(astify(`bool res = remote_async_call(${callArgs});`, "Decl"));
            body.append(astify(`if(!res) {printf("ERROR! Remote execution error in ${name}\\n");}`, "Stmt"));
        } else {
            body.append(astify(`arg_t* a = remote_sync_call(${callArgs});`, "Decl"));
            if (returnType.c_type !== "void") {
                let val = `a->val.${types.getJamlibCode(returnType)}`;
			    if (returnType.jamlib === "nval") {
				    body.append(astify(`${properType} rval;`, "Decl"));
                    body.append(astify(`nvoid_cpy((nvoid_t*)&rval, ${val});`, "Stmt"));
		        } else
				    body.append(astify(`${properType} rval=${val};`, "Decl"));
                body.append(astify(`command_args_free(a);`, "Stmt"));
                body.append(astify(`return rval;`, "Stmt"));
            } else
                body.append(astify(`command_args_free(a);`, "Stmt"));
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
