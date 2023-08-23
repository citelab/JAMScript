const types = require('./types');
const astify = require('./cAstMatcher').astify;
const namespace = require('./namespace');

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
    createFormatAndArray: function(param, elements) { // idk what this does
        let result = {
            formatString: "",
            valueArray: []
        };

        let prefix =  (param.includes('&') ? param.slice(1, param.length) + "." : param + "->");

        for (let i = 0; i < elements.length; i++) {
            result.formatString += types.getCCode(elements[i].type);
            result.valueArray.push('"' + elements[i].name + '"')
            result.valueArray.push(prefix + elements[i].name);
        }

        return result;
    },
    createFormatAndArrayForRead: function(param, elements) { // ditto
        let result = {
            formatString: "",
            valueArray: []
        };

        let prefix =  (param.includes('&') ? param.slice(1, param.length) + "." : param + "->")

        for (let i = 0; i < elements.length; i++) {
            result.formatString += types.getCCode(elements[i].type);
            result.valueArray.push('"' + elements[i].name + '"')
            result.valueArray.push('&(' + prefix + elements[i].name + ')');
        }

        return result;
    },
};

function getJdataType(jdata) {
    if (jdata.type === "Jdata_spec_Basic") {
        return types.stringifyType(node.jamtype);
    } else if (jdata.type === "Jdata_spec_Struct"){
        return `struct ${node.struct_name}`;
    } else if (jdata.type === "Jdata_spec_Array") {
        return `struct ${types.registerArrayType(types.stringifyType(node.jamtype), node.array)}`
    }
    throw "ERROR: not a Jdata_spec"
}

function uflowWriteWrapper(jdata) {
    let name = namespace.translateAccess("write", jdata.namespace_name);
    let data_type = getJdataType(jdata);
    let func = astify(`void ${name}(const ${data_type} value) {}`, "Function_def");
    switch(node.jamtype) {
    case "char":
    case "int":
    case "long long int":
        func.body.block.push(astify(`ufwrite_int(${jdata.namespace_name}, value);`, "Expr_stmt"));
    case "float":
    case "double":
        func.body.block.push(astify(`ufwrite_double(${jdata.namespace_name}, (double)value);`, "Expr_stmt"));
    }
}

function dflowReadWrapper(jdata) {

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
				let structCall = jdata.createFormatAndArray(param, pobj.type_spec.entries);
				return `ufwrite_struct(${psrc},"${structCall.formatString}",${structCall.valueArray.join(",")})`;
			}
			let structCall = jdata.createFormatAndArrayForRead(param, pobj.type_spec.entries);
			return `dfread_struct(${psrc}, "${structCall.formatString}", ${structCall.valueArray.join(", ")})`;
		}
	}
	return left.cTranslator + call.cTranslator;
};
