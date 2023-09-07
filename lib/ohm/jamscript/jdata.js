const types = require('./types');
const astify = require('./cAstMatcher').astify;
const namespace = require('./namespace');

const size_until_malloc_buffers = 8192;

function getJdataType(jdata, pf = false) {
    if (jdata.type === "Jdata_spec_Basic") {
        return types.stringifyType(jdata.jamtype) + (pf ? "*" : "");
    } else if (jdata.type === "Jdata_spec_Struct"){
        return `struct ${jdata.struct_name.name}*`;
    } else if (jdata.type === "Jdata_spec_Array") {
        return `struct ${types.registerArrayType(types.stringifyType(jdata.jamtype), jdata.array)}*`
    }
    throw "ERROR: not a Jdata_spec"
}

module.exports = {
    createCVariables: function(jdata, decls = []) {
        decls.push(astify("dpanel_t *dp;", "Decl"));
        let func = astify("void dp_flow_defs(){}", "Function_def");
        for (var [key, value] of jdata) {
            if (value.jflow === 'uflow') {
                decls.push(astify(`uftable_entry_t* ${key};`, "Decl"));
                func.body.block.push(astify(`${key} = dp_create_uflow(dp, "${key}", "-");`, "Expr_stmt"));
                decls.push(this.uflowWriteWrapper(value));
            } else if (value.jflow === 'dflow') {
                decls.push(astify(`dftable_entry_t* ${key};`, "Decl"));
                func.body.block.push(astify(`${key} = dp_create_dflow(dp, "${key}", "-");`, "Expr_stmt"));
                decls.push(this.dflowReadWrapper(value));
            }
        }
        decls.push(func);
        return decls;
    },

    uflowWriteWrapper: function(jdata) {
        let name = namespace.translateAccess("write", jdata.namespace_name);
        let data_type = getJdataType(jdata);
        let func = astify(`void ${name}(const ${data_type} value) {}`, "Function_def");
        if (jdata.type === "Jdata_spec_Basic") {
            switch(jdata.jamtype.name) {
            case "char":
            case "int":
            case "long long int":
                if (jdata.jamtype.unsigned)
                    func.body.block.push(astify(`ufwrite_uint(${jdata.namespace_name}, (uint64_t)value);`, "Stmt"));
                else
                    func.body.block.push(astify(`ufwrite_int(${jdata.namespace_name}, (int64_t)value);`, "Stmt"));
                break;
            case "float":
            case "double":
                func.body.block.push(astify(`ufwrite_double(${jdata.namespace_name}, (double)value);`, "Stmt"));
                break;
            default:
                throw "ERROR: Unknown Jdata type in uflow";
            }
        } else if (jdata.type === "Jdata_spec_Struct") {
            var codes = "";
            var bufferLength = 9;
            var callArgs = [];
            for (var entry of jdata.struct_entries) {
                var size = 9;
                callArgs.push(astify(`"${entry.name.name}"`, "Expr"));
                if (entry.array) {
                    codes += "n";
                    var tc = types.get(entry.jamtype).c_code;
                    func.body.block.push(astify(`assert(value->${entry.name.name}.typefmt == '${tc}');`, "Stmt"));
                    size = parseInt(entry.array) * (tc === "c" || tc === "b" ?  1 : 9 ) + 8;
                    callArgs.push(astify(`(nvoid_t*)&(value->${entry.name.name})`, "Expr"));
                } else {
                    codes += types.get(entry.jamtype).c_code;
                    callArgs.push(astify(`value->${entry.name.name}`, "Expr"));
                }
                bufferLength += 1 + entry.name.name.length + size;
            }

            var call = astify(`ufwrite_struct(${jdata.namespace_name}, buf, ${bufferLength}, "${codes}");`, "Stmt");
            call.expr.args = call.expr.args.concat(callArgs);
            if (bufferLength < size_until_malloc_buffers) {
                func.body.block.push(astify(`uint8_t buf[${bufferLength}];`, "Decl"));
                func.body.block.push(call);
            } else {
                func.body.block.push(astify(`uint8_t* buf = (uint8_t*)malloc(${bufferLength});`, "Decl"));
                func.body.block.push(call);
                func.body.block.push(astify(`free(buf);`, "Decl"));
            }
        } else if (jdata.type === "Jdata_spec_Array") {
            var tc = types.get(jdata.jamtype).c_code;
            var bufferLength = parseInt(jdata.array) * (tc === "c" || tc === "b" ?  1 : 9 ) + 8;
            func.body.block.push(astify(`assert(value->typefmt == '${tc}');`, "Stmt"));
            var call = astify(`ufwrite_array(${jdata.namespace_name}, buf, ${bufferLength}, (nvoid_t*)value);`, "Stmt");
            if (bufferLength < size_until_malloc_buffers) {
                func.body.block.push(astify(`uint8_t buf[${bufferLength}];`, "Decl"));
                func.body.block.push(call);
            } else {
                func.body.block.push(astify(`uint8_t* buf = (uint8_t*)malloc(${bufferLength});`, "Decl"));
                func.body.block.push(call);
                func.body.block.push(astify(`free(buf);`, "Decl"));
            }
        } else
            throw "ERROR: not a Jdata_spec for uflow"
        return func;
    },

    dflowReadWrapper: function(jdata) {
        let name = namespace.translateAccess("read", jdata.namespace_name);
        let data_type = getJdataType(jdata, true);
        let func = astify(`void ${name}(${data_type} value) {}`, "Function_def");
        if (jdata.type === "Jdata_spec_Basic" || jdata.type === "Jdata_spec_Array") {
            let tc = types.get(jdata.jamtype).c_code;
            if (jdata.array)
                tc = tc.toUpperCase();
            func.body.block.push(astify(`dfread_basic_type(${jdata.namespace_name}, '${tc}', (void*)value);`, "Stmt"));
        } else if (jdata.type === "Jdata_spec_Struct") {
            func.body.block.push(astify(`darg_entry_t darg_mem[${jdata.struct_entries.length}];`, "Decl"));
            var callArgs = [];
            for (var entry of jdata.struct_entries) {
                if (entry.array) {
                    codes += "n";
                    // TODO this should be removed once we flesh out the array implementation more...?
                    func.body.block.push(`value->${entry.name.name}.maxlen = ${parseInt(entry.array.value)};`, "Stmt");
                    func.body.block.push(`value->${entry.name.name}.size = NVOID_ALIGNED_SIZE(${types.stringifyType(entry.jamtype)}, ${parseInt(entry.array.value)})`);
                    func.body.block.push(`value->${entry.name.name}.typesize = sizeof(${types.stringifyType(entry.jamtype)});`, "Stmt");
                    func.body.block.push(`value->${entry.name.name}.typefmt = '${types.get(entry.jamtype).c_code}';`, "Stmt");
                } else
                    codes += types.get(entry.jamtype).c_code;
                callArgs.push(astify(`&(value->${entry.name.name})`, "Expr"));
            }

            var call = astify(`dfread_struct(${jdata.namespace_name}, darg_mem, "${codes}");`, "Stmt");
            call.expr.args = call.expr.args.concat(callArgs);
            func.body.block.push(call);
        } else
            throw "ERROR: not a Jdata_spec for dflow"
        return func;
    },
};
