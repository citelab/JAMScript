const types = require('./types');
const astify = require('./cAstMatcher').astify;
const namespace = require('./namespace');

const size_until_malloc_buffers = 8192;

module.exports = {
    createCVariables: function(jdata) {
        console.log(jdata);
        let decls = [astify("dpanel_t *dp;", "Decl")];
        let func = astify("void dp_flow_defs(){}", "Function_def");
        for (var [key, value] of jdata) {
            if (value.jflow === 'uflow') {
                decls.push(astify(`uftable_entry_t* ${key};`, "Decl"));
                func.body.block.push(astify(`${key} = dp_create_uflow(dp, "${key}", "i");`, "Expr_stmt"));
            } else if (value.jflow === 'dflow') {
                decls.push(astify(`dftable_entry_t* ${key};`, "Decl"));
                func.body.block.push(astify(`${key} = dp_create_dflow(dp, "${key}", "i");`, "Expr_stmt"));
            }
        }
        decls.push(func);
        return decls;
    },
};

function getJdataType(jdata, pf = false) {
    if (jdata.type === "Jdata_spec_Basic") {
        return types.stringifyType(node.jamtype) + {pf ? "*" + ""};
    } else if (jdata.type === "Jdata_spec_Struct"){
        return `struct ${node.struct_name}*`;
    } else if (jdata.type === "Jdata_spec_Array") {
        return `struct ${types.registerArrayType(types.stringifyType(node.jamtype), node.array)}*`
    }
    throw "ERROR: not a Jdata_spec"
}

function uflowWriteWrapper(jdata) {
    let name = namespace.translateAccess("write", jdata.namespace_name);
    let data_type = getJdataType(jdata);
    let func = astify(`void ${name}(const ${data_type} value) {}`, "Function_def");
    if (jdata.type === "Jdata_spec_Basic") {
        switch(node.jamtype.name) {
        case "char":
        case "int":
        case "long long int":
            if (node.jamtype.unsigned)
                func.body.block.push(astify(`ufwrite_uint(${jdata.namespace_name}, (uint64_t)value);`, "Expr_stmt"));
            else
                func.body.block.push(astify(`ufwrite_int(${jdata.namespace_name}, (int64_t)value);`, "Expr_stmt"));
            break;
        case "float":
        case "double":
            func.body.block.push(astify(`ufwrite_double(${jdata.namespace_name}, (double)value);`, "Expr_stmt"));
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
            if (entry.array) {
                codes += "n";
                var tc = types.get(entry.jamtype).c_code;
                func.body.block.push(`value->${entry.name.name}.typefmt = '${tc}';`, "Expr_stmt");
                size = parseInt(entry.array.value) * (tc === "c" || tc === "C" ?  1 : 9 ) + 8;
                callArgs.push(astify(`&(value->${entry.name.name})`, "Expr"));
            } else {
                codes += types.get(entry.jamtype).c_code;
                callArgs.push(astify(`value->${entry.name.name}`, "Expr"));
            }
            bufferLength += 1 + entry.name.name.length + size;
        }

        var call = astify(`ufwrite_struct(${jdata.namespace_name}, buf, ${bufferLength}, "${codes}");`, "Expr_stmt");
        call.expr.args = call.expr.args.concat(callArgs);
        if (bufferLength < size_until_malloc_buffers) {
            func.body.block.push(astify(`uint8_t buf[${bufferLength}];`, "Decl"));
		    func.body.block.push(call);
        } else {
            func.body.block.push(astify(`uint8_t* buf = (uint8_t*)malloc(bufferLength);`, "Decl"));
		    func.body.block.push(call);
            func.body.block.push(astify(`free(buf);`, "Decl"));
        }
    } else if (jdata.type === "Jdata_spec_Array") {
        var tc = types.get(jdata.jamtype).c_code;
        var bufferLength = parseInt(jdata.array.value) * (tc === "c" || tc === "C" ?  1 : 9 ) + 8;
        func.body.block.push(astify(`assert(value->typefmt == '${tc}');`, "Expr_stmt"));
        var call = astify(`ufwrite_array(${jdata.namespace_name}, buf, ${bufferLength}, (nvoid_t*)value);`, "Expr_stmt");
        if (bufferLength < size_until_malloc_buffers) {
            func.body.block.push(astify(`uint8_t buf[${bufferLength}];`, "Decl"));
		    func.body.block.push(call);
        } else {
            func.body.block.push(astify(`uint8_t* buf = (uint8_t*)malloc(bufferLength);`, "Decl"));
		    func.body.block.push(call);
            func.body.block.push(astify(`free(buf);`, "Decl"));
        }
    } else
        throw "ERROR: not a Jdata_spec for uflow"
}

function dflowReadWrapper(jdata) {
    let name = namespace.translateAccess("read", jdata.namespace_name);
    let data_type = getJdataType(jdata, true);
    let func = astify(`void ${name}(${data_type} value) {}`, "Function_def");
    if (jdata.type === "Jdata_spec_Basic") {
        func.body.block.push(astify(`dfread_basic_type(${jdata.namespace_name}, '${types.get(jdata.jamtype).c_code}', (void*)value);`, "Expr_stmt"));
    } else if (jdata.type === "Jdata_spec_Struct") {
        func.body.block.push(astify(`darg_entry_t darg_mem[${jdata.struct_entries.length}];`, "Decl"));
        var callArgs = [];
        for (var entry of jdata.struct_entries) {
            if (entry.array) {
                codes += "n";
                // TODO this should be removed once we flesh out the array implementation more...
                func.body.block.push(`value->${entry.name.name}.maxlen = ${parseInt(entry.array.value)};`, "Expr_stmt");
                func.body.block.push(`value->${entry.name.name}.size = NVOID_ALIGNED_SIZE(${types.stringifyType(entry.jamtype)}, ${parseInt(entry.array.value)})`);
                func.body.block.push(`value->${entry.name.name}.typesize = sizeof(${types.stringifyType(entry.jamtype)});`, "Expr_stmt");
                func.body.block.push(`value->${entry.name.name}.typefmt = '${types.get(entry.jamtype).c_code}';`, "Expr_stmt");
            } else
                codes += types.get(entry.jamtype).c_code;
            callArgs.push(astify(`&(value->${entry.name.name})`, "Expr"));
        }

        var call = astify(`dfread_struct(${jdata.namespace_name}, darg_mem, "${codes}");`, "Expr_stmt");
        call.expr.args = call.expr.args.concat(callArgs);
        func.body.block.push(call);
    } else if (jdata.type === "Jdata_spec_Array") {
        func.body.block.push(astify(`dfread_basic_type(${jdata.namespace_name}, 'n', (void*)value);`, "Expr_stmt"));
    } else
        throw "ERROR: not a Jdata_spec for dflow"
}

__cTranslator.Left_expr_Call = function (left, call) {
	let pobj, psrc;
	let flowfn;
	let param;
	if (left.child(0).ctorName === "Left_expr_Member") { // TODO
		if (left.child(0).child(0).child(0).ctorName === "Primary_expr") { // TODO
			psrc = left.child(0).child(0).child(0).sourceString; // TODO
			pobj = symbolTable.get(psrc);
			if (pobj === undefined || pobj.type !== 'jdata')
				return left.cTranslator + call.cTranslator;
		}
		flowfn = left.child(0).child(1).child(0).child(1).sourceString; // TODO
		param = call.child(1).cTranslator;
		if (typeof(pobj.type_spec) === 'string') {
			console.log("Primary type");
			switch (pobj.type_spec) {
			case 'int':
				return (flowfn === 'write' ? `ufwrite_int(${psrc}, ${param})` : `dfread_int(${psrc}, ${param})`);
			case 'char*':
				return flowfn==='write' ? `ufwrite_str(${psrc}, ${param})` : `dfread_string(${psrc}, ${param})`;
			case 'float':
			case 'double':
				return flowfn==='write'?`ufwrite_double(${psrc}, ${param})` : `dfread_double(${psrc}, ${param})`;
			}
		} else if (typeof(pobj.type_spec) === 'object') {
			if (flowfn === 'write') {
			}
			let structCall = jdata.createFormatAndArrayForRead(param, pobj.type_spec.entries);
			return `dfread_struct(${psrc}, "${structCall.formatString}", ${structCall.valueArray.join(", ")})`;
		}
	}
	return left.cTranslator + call.cTranslator;
};
