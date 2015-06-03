!function(root, factory) {
    "function" == typeof define && define.amd ? define([ "require", "exports", "ometa-core", "../../jsonml/grammars/jsonml_walker.ojs", "../../utils.js" ], factory) : "object" == typeof exports ? factory(require, exports, require("ometa-js").core) : factory(function(moduleName) {
        return root[moduleName];
    }, root, root.OMeta);
}(this, function(require, exports, OMeta) {
    var JsonMLWalker = require("../../jsonml/grammars/jsonml_walker.ojs"), join = require("../../utils.js").join, escape = require("../../utils.js").escape_string, CPretty = JsonMLWalker._extend({
        Id: function() {
            var $elf = this, _fromIdx = this.input.idx, n;
            n = this.anything();
            return n.value();
        },
        Number: function(n) {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                this._pred(n.is("kind", "hex"));
                return join("0x", n.value().toString(16));
            }, function() {
                this._pred(n.is("kind", "oct"));
                return join("0", n.value().toString(8));
            }, function() {
                this._pred(n.is("value", parseFloat(n.original())));
                return n.original();
            }, function() {
                this._apply("empty");
                return n.value().toString();
            });
        },
        String: function() {
            var $elf = this, _fromIdx = this.input.idx, n;
            n = this.anything();
            return join('"', escape(n.value()), '"');
        },
        SequenceExpr: function(n) {
            var $elf = this, _fromIdx = this.input.idx, es;
            es = this._many(function() {
                return this._apply("walk");
            });
            return es.join(", ");
        },
        AssignExpr: function(n) {
            var $elf = this, _fromIdx = this.input.idx, lhs, rhs;
            lhs = this._apply("walk");
            rhs = this._apply("walk");
            return join(lhs, " ", n.operator(), " ", rhs);
        },
        CondExpr: function(n) {
            var $elf = this, _fromIdx = this.input.idx, ce, f, t;
            ce = this._apply("walk");
            t = this._apply("walk");
            f = this._apply("walk");
            return join(ce, " ? ", t, " : ", f);
        },
        BinaryExpr: function(n) {
            var $elf = this, _fromIdx = this.input.idx, lhs, rhs;
            lhs = this._apply("walk");
            rhs = this._apply("walk");
            return join(lhs, " ", n.operator(), " ", rhs);
        },
        UpdateExpr: function(n) {
            var $elf = this, _fromIdx = this.input.idx, e;
            e = this._apply("walk");
            return this._or(function() {
                this._pred(n.is("prefix"));
                return join(n.operator(), e);
            }, function() {
                this._apply("empty");
                return join(e, n.operator());
            });
        },
        UnaryExpr: function(n) {
            var $elf = this, _fromIdx = this.input.idx, e;
            e = this._apply("walk");
            return this._or(function() {
                this._pred(n.operator().match(/^[+-~!*&]$/));
                return join(n.operator(), e);
            }, function() {
                this._apply("empty");
                return join(n.operator(), " ", e);
            });
        },
        CallExpr: function(n) {
            var $elf = this, _fromIdx = this.input.idx, args, e;
            e = this._apply("walk");
            args = this._many(function() {
                return this._apply("walk");
            });
            return join(e, "(", args.join(", "), ")");
        },
        MemberExpr: function(n) {
            var $elf = this, _fromIdx = this.input.idx, ae, e;
            return this._or(function() {
                this._pred(n.is("access", "name"));
                e = this._apply("walk");
                return join(e, ".", n.name());
            }, function() {
                e = this._apply("walk");
                ae = this._apply("walk");
                return join(e, "[", ae, "]");
            });
        },
        PointerExpr: function(n) {
            var $elf = this, _fromIdx = this.input.idx, e;
            this._pred(n.is("access", "pointer"));
            e = this._apply("walk");
            return join(e, "->", n.name());
        },
        GroupExpr: function(n) {
            var $elf = this, _fromIdx = this.input.idx, e;
            e = this._apply("walk");
            return join("(", e, ")");
        },
        VarDeclStmt: function(n) {
            var $elf = this, _fromIdx = this.input.idx, vs;
            vs = this._many1(function() {
                return this._apply("walk");
            });
            return join(this.print_sc(n), vs, join(","), ";");
        },
        VarBinding: function(n) {
            var $elf = this, _fromIdx = this.input.idx, d, i;
            d = this._apply("walk");
            i = this._apply("walk");
            return void 0 != i ? join(d, " = ", i) : d;
        },
        Declarator: function(n) {
            var $elf = this, _fromIdx = this.input.idx, e;
            return this._or(function() {
                this._pred(n.is("type", "member"));
                e = this._apply("walk");
                return void 0 !== e ? join(this.print_ptr(n), n.name(), "[", e, "]") : join(n.name(), "[]");
            }, function() {
                this._pred(n.is("type", "call"));
                e = this._apply("walk");
                return void 0 !== e ? join(this.print_ptr(n), n.name(), "(", e, ")") : join(n.name(), "()");
            }, function() {
                this._pred(n.is("type", "func"));
                return join("(", this.print_ptr(n), n.name(), ")");
            }, function() {
                this._apply("empty");
                return join(this.print_ptr(n), n.name());
            });
        },
        ParamDeclaration: function(n) {
            var $elf = this, _fromIdx = this.input.idx, d;
            d = this._apply("walk");
            return join(this.print_sc(n), d);
        },
        GroupInitializer: function(n) {
            var $elf = this, _fromIdx = this.input.idx, p;
            p = this._many1(function() {
                return this._apply("walk");
            });
            return join("{", p.join(","), "}");
        },
        ExprStmt: function(n) {
            var $elf = this, _fromIdx = this.input.idx, s;
            s = this._many(function() {
                return this._apply("walk");
            });
            return join(s, ";");
        },
        LabeledStmt: function(n) {
            var $elf = this, _fromIdx = this.input.idx, s;
            s = this._apply("walk");
            return join(n.label(), ": ", s);
        },
        CaseStmt: function(n) {
            var $elf = this, _fromIdx = this.input.idx, ex, st;
            ex = this._apply("walk");
            st = this._apply("walk");
            return join("case", ex, ":", st, ";");
        },
        DefaultStmt: function(n) {
            var $elf = this, _fromIdx = this.input.idx, s;
            s = this._apply("walk");
            return join("default:", s, ";");
        },
        CompoundStmt: function(n) {
            var $elf = this, _fromIdx = this.input.idx, d, s;
            d = this._many(function() {
                return this._apply("walk");
            });
            s = this._apply("walk");
            return join("{\n", this.indent(this.join_sc(d)), this.indent(this.join_sc(s)), "}\n");
        },
        IfStmt: function(n) {
            var $elf = this, _fromIdx = this.input.idx, c, f, t;
            c = this._apply("walk");
            t = this._apply("walk");
            return this._or(function() {
                f = this._apply("walk");
                return join("if(", c, ") ", t, " else ", f, ";");
            }, function() {
                this._or(function() {
                    return this._apply("undefined");
                }, function() {
                    return this._apply("empty");
                });
                return join("if(", c, ") ", t, ";");
            });
        },
        SwitchStmt: function(n) {
            var $elf = this, _fromIdx = this.input.idx, se, st;
            se = this._apply("walk");
            st = this._apply("walk");
            return join("switch", "(", se, ")", st, ";");
        },
        WhileStmt: function(n) {
            var $elf = this, _fromIdx = this.input.idx, ce, s;
            ce = this._apply("walk");
            s = this._apply("walk");
            return join("while(", ce, ") ", s, ";");
        },
        DoWhileStmt: function(n) {
            var $elf = this, _fromIdx = this.input.idx, ce, s;
            s = this._apply("walk");
            ce = this._apply("walk");
            return join("do ", s, " while(", ce, ")", ";");
        },
        ForStmt: function(n) {
            var $elf = this, _fromIdx = this.input.idx, ce, ie, s, ue;
            ie = this._apply("walk");
            ce = this._apply("walk");
            ue = this._apply("walk");
            s = this._apply("walk");
            return join("for(", ie, "; ", ce, "; ", ue, ") ", s, ";");
        },
        GotoStmt: function(n) {
            var $elf = this, _fromIdx = this.input.idx;
            this._apply("empty");
            return join("goto ", n.label(), ";");
        },
        ContinueStmt: function(n) {
            var $elf = this, _fromIdx = this.input.idx;
            this._apply("empty");
            return "continue;";
        },
        BreakStmt: function(n) {
            var $elf = this, _fromIdx = this.input.idx;
            this._apply("empty");
            return "break;";
        },
        ReturnStmt: function(n) {
            var $elf = this, _fromIdx = this.input.idx, e;
            e = this._apply("walk");
            return this._or(function() {
                this._pred(void 0 !== e);
                return join("return ", e, ";");
            }, function() {
                this._apply("empty");
                return "return;";
            });
        },
        FuncDefinition: function(n) {
            var $elf = this, _fromIdx = this.input.idx, de, st;
            de = this._apply("walk");
            st = this._apply("walk");
            return join(this.print_sc(n), de, "{", st, "}");
        },
        Program: function(n) {
            var $elf = this, _fromIdx = this.input.idx, cs;
            cs = this._many(function() {
                return this._apply("walk");
            });
            return cs.join(";\n");
        }
    });
    CPretty.print_ptr = function(n) {
        var pointtype = "";
        if (0 == n.pointer_level()) return "";
        void 0 !== n.pointer_type() && (pointtype = n.pointer_type());
        return 1 == n.pointer_level() ? join("* ", pointtype, " ") : join("** ", pointtype, " ");
    };
    CPretty.print_sc = function(n) {
        var scarr = [];
        void 0 !== n.storage_class() && scarr.push(n.storage_class());
        void 0 !== n.type_qual() && scarr.push(n.type_qual());
        void 0 !== n.type_spec() && scarr.push(n.type_spec());
        return scarr.join(" ");
    };
    CPretty.join_sc = function(cs) {
        for (var output = [], i = 0; i < cs.length; i++) output.push(cs[i].match(/}$/) ? cs[i] : cs[i] + ";");
        return output.join("\n");
    };
    CPretty.indent = function(source, opts) {
        opts = opts || {};
        var defaults = function(key, value) {
            "undefined" == typeof opts[key] && (opts[key] = value);
        };
        defaults("width", this.tab_width);
        defaults("first_line", !0);
        var space = Array(opts.width + 1).join(" ");
        return (opts.first_line ? space : "") + source.split("\n").join("\n" + space);
    };
    CPretty.tab_width = 4;
    CPretty.force_rules = !0;
    CPretty.translate = function(input) {
        return CPretty.match(input, "walk");
    };
    module.exports = CPretty;
});