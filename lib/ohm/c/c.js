/* eslint-env node */

'use strict';

let noneNode = (n) => n == null || n.length == 0;

// Translates AST of standard C into text output. Ignores any JAM language additions.
const cTranslator = {
    Source: function(node) {
        this.tabc = 0;
        this.tabd = 0
        this.tabr = function(o = 0) {
            if (this.tabd > 0) {
                this.tabd--;
                return "";
            }
            return "\n" + " ".repeat(4 * (this.tabc + o));
        };
        return this.walk(node.content).join("");
    },
    Preprocess_line: function(node) {
        let flags = noneNode(node.flags) ? "" : " " + this.walk(node.flags).join(" ");
        return "\n# " + this.walk(node.linenum) + " \"" + node.filename +  "\"" + flags;
    },
    numericLiteral: function(node) {return node.value;},
    stringLiteral: function(node) {return node.value;},
    identifier: function(node) {return node.name;},
    Expr_list: function(node) {
        return this.walk(node.exprs).join(", ");
    },
    Assign_expr: function (node) {
        return this.walk(node.lhs) + " " + node.op + " " + this.walk(node.rhs);
    },
    Cond_expr: function(node) {
        return this.walk(node.cond) + " ? " + this.walk(node.then) + " : " + this.walk(node.else);
    },
    Binop_expr: function(node) {
        return this.walk(node.lhs) + " " + node.op + " " + this.walk(node.rhs);
    },
    Prefix_expr: function(node) {
        return node.op + this.walk(node.expr);
    },
    Unary_expr_Sizeof: function(node) {
        return "sizeof " + this.walk(node.expr);
    },
    Unary_expr_SizeofBracketed: function(node) {
        return "sizeof(" + this.walk(node.type_name) + ")";
    },
    Cast_expr: function(node) {
        return "(" + this.walk(node.cast_type) + ")" + this.walk(node.expr);
    },
    Postfix_expr: function(node) {
        return this.walk(node.expr) + node.op;
    },
    Funcall_expr: function(node) {
        return this.walk(node.name) + "(" + this.walk(node.args).join(", ") + ")";
    },
    Array_access_expr: function(node) {
        return this.walk(node.array) + "[" + this.walk(node.index) + "]";
    },
    Struct_access_expr: function(node) {
        return this.walk(node.struct) + "." + this.walk(node.field);
    },
    Pointer_access_expr: function(node) {
        return this.walk(node.pointer) + "->" + this.walk(node.field);
    },
    Paren_expr: function(node) {
        return "(" + this.walk(node.expr) + ")";
    },
    Prototype: function(node) { // TODO check what happens with `extern`
        let ptrs = noneNode(node.pointer_list) ? "" : this.walk(node.pointer_list).join("");
        let params = noneNode(node.params) ? "()" : "(" + this.walk(node.params) + ")";
        let gs = noneNode(node.gcc_attributes) ? "" : " " + this.walk(node.gcc_attributes).join(" ");
        return this.tabr() + this.walk(node.return_type) + ptrs + " " + this.walk(node.name) + params + gs + ";";
    },
    Decl: function(node) {
        return this.tabr() + this.walk(node.decl_type) + this.walk(node.decls).join(", ") + ";";
    },
    Decl_specs: function(node) {
        let lefts = noneNode(node.attributes_left) ? "" : this.walk(node.attributes_left).join(" ") + " ";
        let rights = noneNode(node.attributes_right) ? "" : " " + this.walk(node.attributes_right).join(" ");
        return lefts + this.walk(node.decl_type) + rights;
    },
    Init_decl: function(node) {
        return this.walk(node.decl) + " = " + this.walk(node.init);
    },
    Type_name: function(node) {
        let abs_decl = noneNode(node.abs_decl) ? "" : " " + this.walk(node.abs_decl);
        return this.walk(node.type_quals) + abs_decl;
    },
    Type_spec_Modified: function(node) {
        let type_name = noneNode(node.type_name) ? " int" : " " + this.walk(node.type_name);
        return this.walk(node.type_modifier).join(" ") + type_name;
    },
    Struct_spec_Full: function(node) {
        let gs = noneNode(node.gcc_attributes) ? "" : this.walk(node.gcc_attributes).join(" ") + " ";
        this.tabc++;
        let out = "struct " + gs + this.walk(node.name) + " {" + this.walk(node.decls).join("") + this.tabr(-1) + "}";
        this.tabc--;
        return out;
    },
    Struct_spec_Empty: function(node) {
        let gs = noneNode(node.gcc_attributes) ? "" : this.walk(node.gcc_attributes).join(" ") + " ";
        return "struct " + gs + this.walk(node.name);
    },
    Struct_spec_Anonymous: function(node) {
        let gs = noneNode(node.gcc_attributes) ? "" : this.walk(node.gcc_attributes).join(" ") + " ";
        this.tabc++;
        let out = "struct " + gs + "{" + this.walk(node.decls).join("") + this.tabr(-1) + "}";
        this.tabc--;
        return out;
    },
    Union_spec_Full: function(node) {
        let gs = noneNode(node.gcc_attributes) ? "" : this.walk(node.gcc_attributes).join(" ") + " ";
        this.tabc++;
        let out = "union " + gs + this.walk(node.name) + " {" + this.walk(node.decls).join("") + this.tabr(-1) + "}";
        this.tabc--;
        return out;
    },
    Union_spec_Empty: function(node) {
        let gs = noneNode(node.gcc_attributes) ? "" : this.walk(node.gcc_attributes).join(" ") + " ";
        return "union " + gs + this.walk(node.name);
    },
    Union_spec_Anonymous: function(node) {
        let gs = noneNode(node.gcc_attributes) ? "" : this.walk(node.gcc_attributes).join(" ") + " ";
        this.tabc++;
        let out = "union " + gs + "{" + this.walk(node.decls).join("") + this.tabr(-1) + "}";
        this.tabc--;
        return out;
    },
    Struct_decl_Full: function(node) {
        let ppl = noneNode(node.ppl) ? "" : this.walk(node.ppl);
        return ppl + this.tabr() + this.walk(node.decl_type) + " " + this.walk(node.decls).join(", ") + ";";
    },
    Spec_qual_list: function(node) {
        let lefts = noneNode(node.attributes_left) ? "" : this.walk(node.attributes_left).join(" ") + " ";
        let rights = noneNode(node.attributes_right) ? "" : " " + this.walk(node.attributes_right).join(" ");
        return lefts + this.walk(node.decl_type) + rights;
    },
    Sdeclarator_DeclExpr: function(node) {
        let gs = noneNode(node.gcc_attributes) ? "" : " " + this.walk(node.gcc_attributes);
        return this.walk(node.decl) +  ": " + this.walk(node.expr) + gs;
    },
    Sdeclarator_Expr: function(node) {
        let gs = noneNode(node.gcc_attributes) ? "" : " " + this.walk(node.gcc_attributes).join(" ");
        return ": " + this.walk(node.expr) + gs;
    },
    Enum_spec_Full: function(node) {
        let gs = noneNode(node.gcc_attributes) ? "" : this.walk(node.gcc_attributes).join(" ") + " ";
        this.tabc++;
        let enums = noneNode(node.enums) ? "" : this.walk(node.enums).join(",");
        this.tabc--;
        return "enum " + gs + this.walk(node.name) + " {" + enums + this.tabr() + "}";
    },
    Enum_spec_Empty: function(node) {
        let gs = noneNode(node.gcc_attributes) ? "" : this.walk(node.gcc_attributes).join(" ") + " ";
        return "enum " + gs + this.walk(node.name);
    },
    Enum_spec_Anonymous: function(node) {
        let gs = noneNode(node.gcc_attributes) ? "" : this.walk(node.gcc_attributes).join(" ") + " ";
        this.tabc++;
        let enums = noneNode(node.enums) ? "" : this.walk(node.enums).join(",");
        this.tabc--;
        return "enum " + gs + "{" + enums + this.tabr() + "}";
    },
    Enumerator_IdExpr: function(node) {
        let ppl = noneNode(node.ppl) ? "" : this.walk(node.ppl);
        return ppl + this.tabr() + this.walk(node.name) + " = " + this.walk(node.expr);
    },
    Enumerator_Id: function(node) {
        let ppl = noneNode(node.ppl) ? "" : this.walk(node.ppl);
        return ppl + this.tabr() + this.walk(node.name);
    },
    Declarator: function(node) {
        let pointers = noneNode(node.pointer_list) ? "" : this.walk(node.pointer_list).join("");
        let gcc_asm = noneNode(node.gcc_asm) ? "" : " " + this.walk(node.gcc_asm);
        let gcc_attributes = noneNode(node.gcc_attributes) ? "" : " " + this.walk(node.gcc_attributes).join(" ");
        return pointers + " " + this.walk(node.name) + gcc_asm + gcc_attributes;
    },
    Function_decl: function(node) { // TODO check what happens with function with 0 params
        return this.walk(node.name) + "(" + this.walk(node.params) + ")";
    },
    Array_decl: function(node) {
        return this.walk(node.name) + this.walk(node.array);
    },
    Paren_decl: function(node) {
        let gcc_attributes = noneNode(node.gcc_attributes) ? "" : this.walk(node.gcc_attributes).join(" ") + " ";
        return "(" + gcc_attributes + this.walk(node.decl) + ")";
    },
    Abs_declarator_PointerListDADecl: function(node) {
        let gcc_asm = noneNode(node.gcc_asm) ? "" : " " + this.walk(node.gcc_asm);
        let gcc_attributes = noneNode(node.gcc_attributes) ? "" : " " + this.walk(node.gcc_attributes).join(" ");
        return this.walk(node.pointer_list).join("") + " " + this.walk(node.decl) + gcc_asm + gcc_attributes;
    },
    Abs_declarator_PointerList: function(node) {
        let gcc_asm = noneNode(node.gcc_asm) ? "" : " " + this.walk(node.gcc_asm);
        let gcc_attributes = noneNode(node.gcc_attributes) ? "" : " " + this.walk(node.gcc_attributes).join(" ");
        return this.walk(node.pointer_list).join("") + gcc_asm + gcc_attributes;
    },
    Abs_declarator_DADecl: function(node) {
        let gcc_asm = noneNode(node.gcc_asm) ? "" : " " + this.walk(node.gcc_asm);
        let gcc_attributes = noneNode(node.gcc_attributes) ? "" : " " + this.walk(node.gcc_attributes).join(" ");
        return this.walk(node.decl) + gcc_asm + gcc_attributes;
    },
    Dir_abs_declarator_ConstExpr: function(node) {
        let decl = noneNode(node.decl) ? "" : this.walk(node.decl);
        let expr = noneNode(node.array_expr) ? "" : this.walk(node.array_expr);
        return decl + "[" + expr + "]";
    },
    Dir_abs_declarator_ParamTypeList: function(node) {
        let decl = noneNode(node.decl) ? "" : this.walk(node.decl);
        let params = noneNode(node.params) ? "" : this.walk(node.params);
        return decl + "(" + params + ")";
    },
    Dir_abs_declarator_AbsDecl: function(node) {
        let gcc_attributes = noneNode(node.gcc_attributes) ? "" : this.walk(node.gcc_attributes).join(" ") + " ";
        return "(" + gcc_attributes + this.walk(node.decl) + ")";
    },
    Pmember_decl: function(node) {
        let type_modifiers = noneNode(node.type_modifiers) ? "" : this.walk(node.type_modifiers).join(" ");
        let expr = noneNode(node.expr) ? "" : this.walk(node.expr);
        if (node.expr != null && node.type_modifiers != null)
            type_modifiers += " ";
        return "[" + type_modifiers + expr + "]"
    },
    Pointer: function(node) {
        return noneNode(node.qualifiers) ? "*" : "*" + this.walk(node.qualifiers).join(" ");
    },
    Param_type_lst_VarArgs: function(node) {
        return this.walk(node.params).join(", ") + ", ...";
    },
    Param_type_lst_ConArgs: function(node) {
        return this.walk(node.params).join(", ");
    },
    Param_decl_Declarator: function(node) {
        return this.walk(node.param_type) + this.walk(node.name);
    },
    Param_decl_AbsDeclarator: function(node) {
        return this.walk(node.param_type) + this.walk(node.name);
    },
    Initializer_list: function(node) {
        return noneNode(node.inits) ? "{}" : "{" + this.walk(node.inits).join(", ") + "}";
    },
    Init_field_Designated: function(node) {
        return this.walk(node.desigs).join("") + " = " + this.walk(node.init);
    },
    Desig_field_Struct: function(node) {
        return "." + this.walk(node.field);
    },
    Desig_field_Array: function(node) {
        let end = noneNode(node.end) ? "" : " ... " + this.walk(node.end);
        return "[" + this.walk(node.start) + end + "]";
    },
    // TODO gcc stuffs
    Expr_stmt: function(node) {
        return noneNode(node.expr) ? ";" : this.tabr() + this.walk(node.expr) + ";";
    },
    Label_stmt: function(node) {
        return this.tabr(-1) + this.walk(node.label) + ": " + this.walk(node.stmt) + ";";
    },
    Case_stmt: function(node) {
        return this.tabr(-1) + "case " + this.walk(node.cond) + ": " + this.walk(node.stmt) + ";";
    },
    Default_stmt: function(node) {
        return this.tabr(-1) + "default: " + this.walk(node.stmt) + ";";
    },
    Compound_stmt: function(node) {
        this.tabc++;
        let block = noneNode(node.block) ? "{}" : "{" + this.walk(node.block).join("") + this.tabr(-1) + "}";
        this.tabc--;
        return block;
    },
    If_stmt: function(node) {
        let else_str = noneNode(node.else) ? "" : " else " + this.walk(node.else)
        return this.tabr() + "if (" + this.walk(node.cond) + ") " + this.walk(node.stmt) + else_str;
    },
    Switch_stmt: function(node) {
        return this.tabr() + "switch (" + this.walk(node.cond) + ") " + this.walk(node.stmt);
    },
    While_stmt: function(node) {
        return this.tabr() + "while (" + this.walk(node.cond) + ") " + this.walk(node.stmt);
    },
    DoWhile_stmt: function(node) {
        return this.tabr() + "while " + this.walk(node.stmt) + " do (" + this.walk(node.cond) + ");";
    },
    For_stmt: function(node) { // this one is kind of ugly for formatting reasons
        this.tabd++;
        let expr_init = this.walk(node.init);
        this.tabd = 0;
        let cond = noneNode(node.cond.expr) ? ";" : " " + this.walk(node.cond.expr) + ";";
        let iter = noneNode(node.iter) ? "" : " " + this.walk(node.iter);
        return this.tabr() + "for (" + expr_init + cond + iter + ") " + this.walk(node.stmt);
    },
    Goto_stmt: function (node) {
        return this.tabr() + "goto " + this.walk(node.label) + ";";
    },
    Continue_stmt: function(node) {
        return this.tabr() + "continue;"
    },
    Break_stmt: function(node) {
        return this.tabr() + "break;"
    },
    Return_stmt: function (node) {
        let val = noneNode(node.expr) ? "" : " " + this.walk(node.expr);
        return this.tabr() + "return" + val + ";";
    },
    Function_def: function(node) {
        return this.tabr() + this.walk(node.return_type) + this.walk(node.decl) + " " + this.walk(node.body);
    },
    _default: function(node) {
        // TODO eventually this should throw an error... for now debugging is nice
        console.log("Unrecognized node:");
        console.log(node);
        return "";
    }
};

module.exports = {
  cTranslator: cTranslator,
};
