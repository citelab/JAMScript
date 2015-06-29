!function(root, factory) {
    "function" == typeof define && define.amd ? define([ "require", "exports", "ometa-core", "../../c/grammars/c_translator.ojs", "../../../deps/es5/grammars/es5_translator.ojs", "../../../utils.js" ], factory) : "object" == typeof exports ? factory(require, exports, require("ometa-js").core) : factory(function(moduleName) {
        return root[moduleName];
    }, root, root.OMeta);
}(this, function(require, exports, OMeta) {
    var CTranslator = require("../../c/grammars/c_translator.ojs"), ES5Translator = require("../../../deps/es5/grammars/es5_translator.ojs"), join = require("../../../utils.js").join, escape = require("../../../utils.js").escape_string, ActivityID = 0, JAMCTranslator = CTranslator._extend({
        NamespaceSpec: function(n) {
            var $elf = this, _fromIdx = this.input.idx;
            this._apply("empty");
            return n.name();
        },
        JDeclaration: function(n) {
            var $elf = this, _fromIdx = this.input.idx, d, na, s;
            s = this._opt(function() {
                return this._applyWithArgs("walkType", "DeclSpec");
            });
            d = this._apply("walk");
            na = this._opt(function() {
                return this._apply("walk");
            });
            return this.rules.JDeclaration(n.sync(), s, d, na);
        },
        ODeclaration: function(n) {
            var $elf = this, _fromIdx = this.input.idx, d;
            d = this._apply("walk");
            return this.rules.ODeclaration(n.type(), d);
        },
        CompoundStmt: function(n) {
            var $elf = this, _fromIdx = this.input.idx, d, s;
            return this._or(function() {
                this._pred(this.context.TarActivityCtx());
                d = this._many(function() {
                    return this._apply("walk");
                });
                s = this._many(function() {
                    return this._apply("walk");
                });
                return this.rules.CompoundStmt(d, s);
            }, function() {
                return CTranslator._superApplyWithArgs(this, "CompoundStmt");
            });
        },
        BlockStmt: function(n) {
            var $elf = this, _fromIdx = this.input.idx, cs;
            return this._or(function() {
                this._pred(this.context.TarActivityCtx());
                cs = this._many(function() {
                    return this._applyWithArgs("foreign", ES5Translator, "walk");
                });
                return this.rules.BlockStmt(cs);
            }, function() {
                return this._applyWithArgs("foreign", ES5Translator, "BlockStmt");
            });
        },
        CompleteBlock: function(n) {
            var $elf = this, _fromIdx = this.input.idx, d, s;
            d = this._apply("walk");
            s = this._applyWithArgs("foreign", ES5Translator, "walk");
            return this.rules.CompleteBlock(d, s);
        },
        ErrorBlock: function(n) {
            var $elf = this, _fromIdx = this.input.idx, d, s;
            d = this._apply("walk");
            s = this._applyWithArgs("foreign", ES5Translator, "walk");
            return this.rules.ErrorBlock(d, s);
        },
        CompleteStmt: function(n) {
            var $elf = this, _fromIdx = this.input.idx, d, s;
            d = this._apply("walk");
            s = this._apply("walk");
            return this.rules.CompleteStmt(d, s);
        },
        ErrorStmt: function(n) {
            var $elf = this, _fromIdx = this.input.idx, d, s;
            d = this._apply("walk");
            s = this._apply("walk");
            return this.rules.ErrorStmt(d, s);
        },
        CancelStmt: function(n) {
            var $elf = this, _fromIdx = this.input.idx, d, s;
            d = this._apply("walk");
            s = this._apply("walk");
            return this.rules.CancelStmt(d, s);
        },
        VerifyStmt: function(n) {
            var $elf = this, _fromIdx = this.input.idx, d, s;
            d = this._apply("walk");
            s = this._apply("walk");
            return this.rules.VerifyStmt(d, s);
        },
        ActivityDef: function(n) {
            var $elf = this, _fromIdx = this.input.idx, cas, cs, es, j, s, vs;
            this._pred(this.context.SetActivityCtx());
            j = this._apply("walk");
            s = this._apply("walk");
            cs = this._opt(function() {
                return this._apply("walk");
            });
            es = this._opt(function() {
                return this._apply("walk");
            });
            cas = this._opt(function() {
                return this._apply("walk");
            });
            vs = this._opt(function() {
                return this._apply("walk");
            });
            return this.rules.ActivityDef(n.type(), j, s, cs, es, cas, vs);
        }
    });
    JAMCTranslator.context = function() {
        var ActivityID = 0, inActivityFlag = !1;
        return {
            SetActivityCtx: function() {
                ActivityID = Math.random().toString(36).substring(7);
                inActivityFlag = !0;
                return !0;
            },
            TarActivityCtx: function() {
                var flag = inActivityFlag;
                inActivityFlag = !1;
                return flag;
            },
            TestActivityCtx: function() {
                return inActivityFlag;
            }
        };
    }();
    JAMCTranslator.rules = {
        JDeclaration: function(sflag, spec, decl, namespc) {
            var cdecl = join(spec, decl);
            return {
                sync: sflag,
                declaration: cdecl,
                namespace: namespc
            };
        },
        ODeclaration: function(otype, decl) {
            return join(otype, " ", decl);
        },
        CompoundStmt: function(d, s) {
            var c_output, js_output;
            return {
                C: c_output,
                JS: js_output
            };
        },
        BlockStmt: function(cs) {},
        CompleteBlock: function(odecl, block) {
            return join("ActivityID = ", ActivityID, " ", odecl, block);
        },
        ErrorBlock: function(odecl, block) {
            return join(odecl, block);
        },
        CompleteStmt: function(odecl, stmt) {
            return join(odecl, block);
        },
        ErrorStmt: function(odecl, stmt) {
            return join(odecl, block);
        },
        VerifyStmt: function(odecl, stmt) {
            return join(odecl, block);
        },
        ActivityDef: function(atype, jdecl, stmt, cmpstmt, errstmt, cnclstmt, vrfystmt) {
            return join(atype, " -A- ", jdecl, " -J- ", stmt, " -S- ", cmpstmt, " -C- ", errstmt);
        }
    };
    JAMCTranslator.force_rules = !1;
    JAMCTranslator.translate = function(input) {
        return JAMCTranslator.match(input, "walk");
    };
    module.exports = JAMCTranslator;
});