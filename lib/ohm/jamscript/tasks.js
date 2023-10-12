const types = require('./types');
const astify = require('./cAstMatcher').astify;
const symbolTable = require('./symbolTable');

module.exports = {
    createCTaskWrapperInC: function(ctask, decls) {
        let cOut = astify(`void wrapper_${ctask.name}(context_t ctx) {}`, 'Function_def');
        let body = [];
        body.push(astify('(void)ctx;', "Stmt"));
        body.push(astify('arg_t* t = (arg_t*)(task_get_args());', "Decl"));
        let args = ctask.params.map((type, index) => astify(`t[${index}].val.${types.get(type).jamlib}`,"Expr"));
        args = types.castLocalArgs(args, ctask.params);

        let reuse = ctask.jtask_attr.reuse;
        let reuse_history = ctask.jtask_attr.reuse_history;

        if (reuse || reuse_history) {
            reuse = reuse ? reuse.name : "default";
            reuse_history ||= 1;
            let reusedef = {};
            if (reuse === "default") {
                reusedef.namespaced_name = "__jsys__jreusedefault" + ctask.name;
                reusedef.reuse_spec = ctask.default_reuse_func_type = types.generateReuseSpec(ctask.params);
                let conds = [];
                for (var [index, param] of ctask.params.entries()) {
                    if (param.type === "Jamparam_decl_String") {
                        conds.push(`!strcmp(new.arg_${index}, old.arg_${index})`);
                    } else if (param.array) {
                        conds.push(`new.arg_${index}->len == old.arg_${index}->len`);
                        conds.push(`new.arg_${index}->typefmt == old.arg_${index}->typefmt`);
                        conds.push(`!memcmp(new.arg_${index}->data, old.arg_${index}->data, old.arg_${index}->len * old.arg_${index}->typesize)`);
                    } else
                        conds.push(`new.arg_${index} == old.arg_${index}`);
                }

                decls.push(reusedef.reuse_spec.struct_decl);
                decls.push(astify(`int ${reusedef.namespaced_name}(${reusedef.reuse_spec.typename} old, ${reusedef.reuse_spec.typename} new) {
                                     return ${conds.join("&&")};
                                   }`, "Function_def"));
            } else {
                if (!symbolTable.jreuse.c.has(reuse))
                    throw `ERROR: cside jreuse function ${reuse} undefined`;
                reusedef = symbolTable.jreuse.c.get(reuse);
                if (!reusedef.reuse_spec) {
                    reusedef.reuse_spec = types.generateReuseSpec(ctask.params);
                } else
                    types.checkReuseSpec(ctask.params, reusedef.reuse_spec);
            }
            decls.push(astify(`${reusedef.reuse_spec.typename} __jsys__jreusebuf${ctask.name}[${reuse_history}];`, "Decl"));
            decls.push(astify(`int __jsys__jreuseind${ctask.name}=0, __jsys__jreusecnt${ctask.name}=0;`, "Decl"));
            var jreuse_args = [];
            var jre_cleanup = [];
            var jrn_cleanup = [];
            for (var [index, param] of ctask.params.entries()) {
                let argv = `t[${index}].val.${types.get(param).jamlib}`;
                if (param.type === "Jamparam_decl_String") {
                    jreuse_args.push(`strdup(${argv})`);
                    jre_cleanup.push(`free(__jsys__jreusebuf${ctask.name}[__jsys__jreuseind${ctask.name}].arg_${index});`);
                    jrn_cleanup.push(`free(jrn.arg_${index});`);
                } else if (param.array) {
                    var atype = types.registerArrayType(types.stringifyType(param.jamtype), 1);
                    jreuse_args.push(`(struct ${atype}*)nvoid_dup((nvoid_t*)${argv})`);
                    jre_cleanup.push(`free(__jsys__jreusebuf${ctask.name}[__jsys__jreuseind${ctask.name}].arg_${index});`);
                    jrn_cleanup.push(`free(jrn.arg_${index});`);
                } else
                    jreuse_args.push(`${argv}`);
            }

            body.push(astify(`${reusedef.reuse_spec.typename} jrn = {${jreuse_args}};`, "Decl"));

            let reuseret = "";
            if (ctask.return_type) {
                let retType = types.get(ctask.return_type);
                let reuseretval = "";
                if (ctask.return_type.type === "Jamtype_return_Array")
                    reuseretval = `retarg.val.${retType.jamlib} = nvoid_dup((nvoid_t*)&__jsys__jreuseres${ctask.name}[reui % ${reuse_history}]);`;
                else if (ctask.return_type.name !== "void")
                    reuseretval = `retarg.val.${retType.jamlib} = __jsys__jreuseres${ctask.name}[reui % ${reuse_history}];`;
                reuseret = `arg_t retarg;
                            retarg.type = '${retType.c_code}';
                            retarg.nargs = 1;
                            ${reuseretval}
                            mco_push(mco_running(), &retarg, sizeof(arg_t));`;
            }

            body.push(astify(`for (int reui = __jsys__jreuseind${ctask.name}; reui < __jsys__jreuseind${ctask.name} + __jsys__jreusecnt${ctask.name}; reui++) {
                               if (${reusedef.namespaced_name}(__jsys__jreusebuf${ctask.name}[reui % ${reuse_history}], jrn)) {
                                 command_args_free(t);
                                 ${jrn_cleanup.join("")}
                                 ${reuseret}
                                 return;
                               }
                             }`, "Stmt"));
        }
        if (!ctask.return_type) {
            let funcall = astify(`${ctask.name}();`, "Expr_stmt");
            funcall.expr.args = args;
            body.push(funcall);
            if (reuse) {
                body.push(astify(`__jsys__jreuseind${ctask.name} = (${reuse_history} + __jsys__jreuseind${ctask.name} - 1) % ${reuse_history};`, "Expr_stmt"));
                body.push(astify(`if (__jsys__jreusecnt${ctask.name} == ${reuse_history}) {${jre_cleanup.join("")}} else {__jsys__jreusecnt${ctask.name}++;}`, "Stmt")); // free nvoids we evict from buf
                body.push(astify(`__jsys__jreusebuf${ctask.name}[__jsys__jreuseind${ctask.name}] = jrn;`, "Expr_stmt"));
            }
            body.push(astify('command_args_free(t);', "Expr_stmt"));
        } else {
            let retType = types.get(ctask.return_type);
            body.push(astify('arg_t retarg;', "Decl"));
            body.push(astify(`retarg.type = '${retType.c_code}';`, "Stmt"));
            body.push(astify('retarg.nargs = 1;', "Stmt"));
            let funcall;
            if (ctask.return_type.name === "void") {
                funcall = astify(`${ctask.name}();`, "Stmt");
                funcall.expr.args = args;
            } else if (ctask.return_type.type === "Jamtype_return_Array") {
                let atype = types.registerArrayType(types.stringifyType(ctask.return_type.jamtype), ctask.return_type.array);
                body.push(astify(`struct ${atype} da = ${ctask.name}();`, "Decl"));
                body.at(-1).decls[0].init.args = args;
                funcall = astify(`retarg.val.${retType.jamlib} = nvoid_dup((nvoid_t*)&da);`,"Stmt");
            } else {
                funcall = astify(`retarg.val.${retType.jamlib} = ${ctask.name}();`, "Stmt");
                funcall.expr.rhs.args = args;
            }
            body.push(funcall);
            body.push(astify('command_args_free(t);', "Stmt"));
            if (reuse) {
                body.push(astify(`__jsys__jreuseind${ctask.name} = (${reuse_history} + __jsys__jreuseind${ctask.name} - 1) % ${reuse_history};`, "Expr_stmt"));
                body.push(astify(`if (__jsys__jreusecnt${ctask.name} == ${reuse_history}) {${jre_cleanup.join("")}} else {__jsys__jreusecnt${ctask.name}++;}`, "Stmt")); // free nvoids we evict from buf
                body.push(astify(`__jsys__jreusebuf${ctask.name}[__jsys__jreuseind${ctask.name}] = jrn;`, "Expr_stmt"));
                if (ctask.return_type.type === "Jamtype_return_Array")
                    body.push(astify(`__jsys__jreuseres${ctask.name}[__jsys__jreuseind${ctask.name}] = da;`, "Stmt"));
                else if (ctask.return_type.name !== "void")
                    body.push(astify(`__jsys__jreuseres${ctask.name}[__jsys__jreuseind${ctask.name}] = retarg.val.${retType.jamlib};`, "Stmt"));
            }
            body.push(astify('mco_push(mco_running(), &retarg, sizeof(arg_t));', "Stmt"));
        }
        cOut.body.block = body;
        return cOut;
    },

    createCSyncLocalWrapper: function(ctask, decls) {
        if (!ctask.return_type)
            return;
        let properType = types.stringifyType(ctask.return_type);
        if (ctask.return_type.type === "Jamtype_return_Array")
            properType = "struct " + types.registerArrayType(types.stringifyType(ctask.return_type.jamtype), ctask.return_type.array);

        let cProto = astify(`${properType} ${ctask.name}();`, "Prototype");
        cProto.params = {type: "Param_type_lst_ConArgs",
                         params: ctask.params.map(type => type.c_decl)};

        let cOut = astify(`${properType} local_wrapper_${ctask.name}() {}`, "Function_def");
        cOut.decl.name.params = {
            type: "Param_type_lst_ConArgs",
            params: ctask.params.map((type, index) =>
                astify(`${types.get(type).c_type} arg_${index}`, "Param_decl"))
        };

        let body = [];

        let reuse = ctask.jtask_attr.reuse;
        let reuse_history = ctask.jtask_attr.reuse_history;
        if (reuse || reuse_history) {
            reuse = reuse ? reuse.name : "default";
            reuse_history ||= 1;

            let reusedef = {};
            if (reuse === "default") {
                reusedef.reuse_spec = ctask.default_reuse_func_type;
                reusedef.namespaced_name = "__jsys__jreusedefault" + ctask.name;
            } else {
                if (!symbolTable.jreuse.c.has(reuse))
                    throw `ERROR: cside jreuse function ${reuse} undefined`;
                reusedef = symbolTable.jreuse.c.get(reuse);
                if (!reusedef.reuse_spec) {
                    reusedef.reuse_spec = types.generateReuseSpec(ctask.params);
                } else
                    types.checkReuseSpec(ctask.params, reusedef.reuse_spec);
            }

            var jreuse_args = [];
            var jre_cleanup = [];
            var jrn_cleanup = [];
            for (var [index, param] of ctask.params.entries()) {
                if (param.type === "Jamparam_decl_String") {
                    jreuse_args.push(`strdup(arg_${index})`);
                    jre_cleanup.push(`free(__jsys__jreusebuf${ctask.name}[__jsys__jreuseind${ctask.name}].arg_${index});`);
                    jrn_cleanup.push(`free(jrn.arg_${index});`);
                } else if (param.array) {
                    var atype = types.registerArrayType(types.stringifyType(param.jamtype), 1);
                    jreuse_args.push(`(struct ${atype}*)nvoid_dup((nvoid_t*)arg_${index})`);
                    jre_cleanup.push(`free(__jsys__jreusebuf${ctask.name}[__jsys__jreuseind${ctask.name}].arg_${index});`);
                    jrn_cleanup.push(`free(jrn.arg_${index});`);
                } else
                    jreuse_args.push(`arg_${index}`);
            }
            body.push(astify(`${reusedef.reuse_spec.typename} jrn = {${jreuse_args}};`, "Decl"));

            let retType = types.get(ctask.return_type);
            let reuseretval = "return;";
            if (ctask.return_type.name !== "void") {
                reuseretval = `return __jsys__jreuseres${ctask.name}[reui % ${reuse_history}];`;
                decls.push(astify(`${properType} __jsys__jreuseres${ctask.name}[${reuse_history}];`, "Decl"));
            }
            let reuseret = `${jrn_cleanup.join("")}
                            ${reuseretval}`;

            body.push(astify(`for (int reui = __jsys__jreuseind${ctask.name}; reui < __jsys__jreuseind${ctask.name} + __jsys__jreusecnt${ctask.name}; reui++) {
                               if (${reusedef.namespaced_name}(__jsys__jreusebuf${ctask.name}[reui % ${reuse_history}], jrn)) {
                                 ${reuseret}
                               }
                             }`, "Stmt"));
        }

        let callArgs = [];
        let cleanup = [];
        for (var [index, param] of ctask.params.entries()) {
            if (param.type === "Jamparam_decl_String") {
                body.push(astify(`char* arg_${index}_dup = strdup(arg_${index});`, "Decl"));
                cleanup.push(astify(`free(arg_${index}_dup);`, "Stmt"));
                callArgs.push(`arg_${index}_dup`);
            } else if (param.array) {
                body.push(astify(`nvoid_t* arg_${index}_dup = nvoid_dup((nvoid_t*)arg_${index});`, "Decl"));
                cleanup.push(astify(`free(arg_${index}_dup);`, "Stmt"));
                var atype = types.registerArrayType(types.stringifyType(param.jamtype), 1);
                callArgs.push(`(struct ${atype}*)arg_${index}_dup`);
            } else
                callArgs.push(`arg_${index}`);
        }

        if (ctask.return_type.name !== "void") {
            body.push(astify(`${properType} toret = ${ctask.name}(${callArgs});`, "Decl"));
            if (reuse) {
                body.push(astify(`__jsys__jreuseind${ctask.name} = (${reuse_history} + __jsys__jreuseind${ctask.name} - 1) % ${reuse_history};`, "Expr_stmt"));
                body.push(astify(`if (__jsys__jreusecnt${ctask.name} == ${reuse_history}) {${jre_cleanup.join("")}} else {__jsys__jreusecnt${ctask.name}++;}`, "Stmt")); // free nvoids we evict from buf
                body.push(astify(`__jsys__jreusebuf${ctask.name}[__jsys__jreuseind${ctask.name}] = jrn;`, "Expr_stmt"));
                body.push(astify(`__jsys__jreuseres${ctask.name}[__jsys__jreuseind${ctask.name}] = toret;`, "Stmt"));
            }
            body = body.concat(cleanup);
            body.push(astify(`return toret;`, "Stmt"));
        } else {
            body.push(astify(`${ctask.name}(${callArgs});`, "Stmt"));
            if (reuse) {
                body.push(astify(`__jsys__jreuseind${ctask.name} = (${reuse_history} + __jsys__jreuseind${ctask.name} - 1) % ${reuse_history};`, "Expr_stmt"));
                body.push(astify(`if (__jsys__jreusecnt${ctask.name} == ${reuse_history}) {${jre_cleanup.join("")}} else {__jsys__jreusecnt${ctask.name}++;}`, "Stmt")); // free nvoids we evict from buf
                body.push(astify(`__jsys__jreusebuf${ctask.name}[__jsys__jreuseind${ctask.name}] = jrn;`, "Expr_stmt"));
            }
            body = body.concat(cleanup);
        }
        cOut.body.block = body;
        decls.push(cProto);
        decls.push(cOut);
    },
    createJsTaskWrapperInC: function(jtask) {
        let cOut;
        let body = [];
        const args = jtask.params.map((_, index) => `arg_${index}`).join();
        let callArgs = `cnode->tboard, "${jtask.namespace_name}", "${jtask.codes}", ${args}`;
        if (jtask.type === "Async_task") {
            body.push(astify(`bool res = remote_async_call(${callArgs});`, "Decl"));
            body.push(astify(`if(!res) {printf("ERROR! Remote execution error in ${jtask.name}\\n");}`, "Stmt"));
            cOut = astify(`void ${jtask.namespace_name}() {}`, "Function_def");
        } else {
            let properType = types.stringifyType(jtask.return_type);
            if (jtask.return_type.name !== "void") {
                body.push(astify(`arg_t a = remote_sync_call(${callArgs});`, "Decl"));
                let val = `a.val.${types.get(jtask.return_type).jamlib}`;
                if (jtask.return_type.type === "Jamtype_return_Array") {
                    let nvc = types.stringifyType(jtask.return_type.jamtype);
                    let nvt = types.registerArrayType(nvc, jtask.return_type.array);
                    properType = "struct " + nvt;

                    let nvinit = astify(`NVOID_STATIC_INIT_EMPTY(rval, ${[nvt, 0, `'${types.get(jtask.return_type.jamtype).c_code}'`, jtask.return_type.array]});`, "Expr_stmt");
                    nvinit.expr.args[2] = nvc;
                    body.push(nvinit);

                    body.push(astify(`nvoid_cpy((nvoid_t*)&rval, ${val});`, "Stmt"));
                } else
                    body.push(astify(`${properType} rval = ${val};`, "Decl"));
                body.push(astify(`return rval;`, "Stmt"));
            } else
                body.push(astify(`remote_sync_call(${callArgs});`, "Stmt"));
            cOut = astify(`${properType} ${jtask.namespace_name}() {}`, "Function_def");
        }
        cOut.decl.name.params = {
            type: "Param_type_lst_ConArgs",
            params: jtask.params.map((type, index) =>
                astify(`${types.get(type).c_type} arg_${index}`, "Param_decl"))
        };
        cOut.body.block = body;
        return cOut;
    },
};
