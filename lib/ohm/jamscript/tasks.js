const types = require('./types');
const astify = require('./cAstMatcher').astify;

module.exports = {
    createCTaskWrapperInC: function(ctask) { // TODO
        let cOut = astify(`void wrapper_${ctask.name}(context_t ctx) {}`, 'Function_def');
        // if (types.checkNeedsBuffer(returnType))
        //     cOut.decl.params.push(astify(`${types.getCType(returnType)} buf`, "Param_decl"));
        let body = [];
        body.push(astify('(void)ctx;', "Stmt"));
        body.push(astify('arg_t* t = (arg_t*)(task_get_args());', "Decl"));
        let args = ctask.params.map((type, index) => `t[${index}].val.${types.get(type).jamlib}`);
        let funcCall = `${ctask.name}(${args})`;
        if (!ctask.return_type) {
            body.push(astify(`${funcCall};`, "Stmt"));
            body.push(astify('command_args_free(t);', "Expr_stmt"));
        } else {
            let retType = c.types.get(ctask.return_type);
            body.push(astify('arg_t retarg;', "Stmt"));
            body.push(astify(`retarg.type = ${retType.c_enum};`, "Stmt"));
            body.push(astify('retarg.nargs = 1;', "Stmt"));
            if (ctask.return_type.type === "Jamtype_return_Void")
                body.push(astify(`${funcCall};`, "Stmt"));
            else if (ctask.return_type.type === "Jamtype_return_Array")
                body.push(astify(`retarg.val.${retType.jamlib} = nvoid_dup((nvoid_t*)${funcCall});`, "Stmt"));
            else
                body.push(astify(`retarg.val.${retType.jamlib} = ${funcCall};`, "Stmt"));
            // TODO... we don't know whether a string we get as a return type was dynamically or statically allocatd
            // if (returnType === "string") // TODO... shouldn't this already be allocated anyways?
            //     funCall.expr = {type: "Funcall_expr",
            //                     name: {type: "identifier", name: "strdup"},
            //                     args: [funCall.expr]};
            body.push(astify('command_args_free(t);', "Expr_stmt"));
            body.push(astify('mco_push(mco_running(), &retarg, sizeof(arg_t));', "Expr_stmt"));
        }
        cOut.body.block = body;
        return cOut;
    },
    createJsTaskWrapperInC: function(jtask) {
        let returnType = types.get(jtask.return_type);
        let properType = types.stringifyType(jtask.return_type);
        let cOut;
        if (jtask.return_type.type === "Jamtype_return_Array") {
            properType = registerArrayType(types.stringifyType(jtask.return_type.jamtype), jtask.return_type.array);
            cOut = astify(`struct ${properType} ${jtask.namespace_name}() {}`, "Function_def");
        } else
            cOut = astify(`${properType} ${jtask.namespace_name}() {}`, "Function_def");
        cOut.decl.name.params = jtask.params.map((type, index) =>
            astify(`${types.get(type).c_type} arg_${index}`, "Param_decl"));
        let body = [];
        const args = jtask.params.map((_, index) => `arg_${index}`).join();
        let callArgs = `cnode->tboard, "${jtask.namespace_name}", "${jtask.codes}", ${args}`;
        if (jtask.type === "Async_task") {
            body.push(astify(`bool res = remote_async_call(${callArgs});`, "Decl"));
            body.push(astify(`if(!res) {printf("ERROR! Remote execution error in ${jtask.name}\\n");}`, "Stmt"));
        } else {
            body.push(astify(`arg_t* a = remote_sync_call(${callArgs});`, "Decl"));
            if (returnType.c_type !== "void") {
                let val = `a->val.${returnType.jamlib}`;
			    if (returnType.jamlib === "nval") {
				    body.push(astify(`${properType} rval;`, "Decl"));
                    body.push(astify(`nvoid_cpy((nvoid_t*)&rval, ${val});`, "Stmt"));
		        } else
				    body.push(astify(`${properType} rval=${val};`, "Decl"));
                body.push(astify(`command_args_free(a);`, "Stmt"));
                body.push(astify(`return rval;`, "Stmt"));
            } else
                body.push(astify(`command_args_free(a);`, "Stmt"));
        }
        cOut.body.block = body;
        return cOut;
    },
};
