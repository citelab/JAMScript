!function(root, factory) {
    "function" == typeof define && define.amd ? define([ "require", "exports", "ometa-core", "readline" ], factory) : "object" == typeof exports ? factory(require, exports, require("ometa-js").core) : factory(function(moduleName) {
        return root[moduleName];
    }, root, root.OMeta);
}(this, function(require, exports, OMeta) {
    var readline = require("readline"), CParser = OMeta._extend({
        space: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                return OMeta._superApplyWithArgs(this, "space");
            }, function() {
                return this._applyWithArgs("fromTo", "//", "\n");
            }, function() {
                return this._applyWithArgs("fromTo", "/*", "*/");
            });
        },
        isKeyword: function(x) {
            var $elf = this, _fromIdx = this.input.idx;
            return this._pred(CParser._isKeyword(x));
        },
        nameFirst: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                return this._apply("letter");
            }, function() {
                switch (this.anything()) {
                  case "_":
                    return "_";

                  default:
                    throw this._fail();
                }
            });
        },
        nameRest: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                return this._apply("nameFirst");
            }, function() {
                return this._apply("digit");
            });
        },
        iName: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._consumedBy(function() {
                this._apply("nameFirst");
                return this._many(function() {
                    return this._apply("nameRest");
                });
            });
        },
        id: function() {
            var $elf = this, _fromIdx = this.input.idx, name;
            name = this._apply("iName");
            this._not(function() {
                return this._applyWithArgs("isKeyword", name);
            });
            return [ "id", name ];
        },
        keyword: function() {
            var $elf = this, _fromIdx = this.input.idx, kwd;
            kwd = this._apply("iName");
            this._applyWithArgs("isKeyword", kwd);
            return function() {
                console.log("Keyword: ", kwd);
                return [ kwd, kwd ];
            }.call(this);
        },
        num: function() {
            var $elf = this, _fromIdx = this.input.idx, ds;
            ds = this._many1(function() {
                return this._apply("digit");
            });
            return [ "const", parseInt(ds.join("")) ];
        },
        escapeChar: function() {
            var $elf = this, _fromIdx = this.input.idx, c;
            this._applyWithArgs("exactly", "\\");
            c = this._apply("char");
            return unescape("\\" + c);
        },
        str: function() {
            var $elf = this, _fromIdx = this.input.idx, cs, n;
            return this._or(function() {
                switch (this.anything()) {
                  case '"':
                    return this._or(function() {
                        switch (this.anything()) {
                          case '"':
                            this._applyWithArgs("exactly", '"');
                            cs = this._many(function() {
                                return this._or(function() {
                                    return this._apply("escapeChar");
                                }, function() {
                                    this._not(function() {
                                        this._applyWithArgs("exactly", '"');
                                        this._applyWithArgs("exactly", '"');
                                        this._applyWithArgs("exactly", '"');
                                        return '"""';
                                    });
                                    return this._apply("char");
                                });
                            });
                            this._applyWithArgs("exactly", '"');
                            this._applyWithArgs("exactly", '"');
                            this._applyWithArgs("exactly", '"');
                            return [ "string", cs.join("") ];

                          default:
                            throw this._fail();
                        }
                    }, function() {
                        cs = this._many(function() {
                            return this._or(function() {
                                return this._apply("escapeChar");
                            }, function() {
                                this._not(function() {
                                    return this._applyWithArgs("exactly", '"');
                                });
                                return this._apply("char");
                            });
                        });
                        this._applyWithArgs("exactly", '"');
                        return [ "string", cs.join("") ];
                    });

                  case "'":
                    cs = this._many(function() {
                        return this._or(function() {
                            return this._apply("escapeChar");
                        }, function() {
                            this._not(function() {
                                return this._applyWithArgs("exactly", "'");
                            });
                            return this._apply("char");
                        });
                    });
                    this._applyWithArgs("exactly", "'");
                    return [ "string", cs.join("") ];

                  default:
                    throw this._fail();
                }
            }, function() {
                (function() {
                    switch (this.anything()) {
                      case "#":
                        return "#";

                      case "`":
                        return "`";

                      default:
                        throw this._fail();
                    }
                }).call(this);
                n = this._apply("iName");
                return [ "string", n ];
            });
        },
        special: function() {
            var $elf = this, _fromIdx = this.input.idx, s;
            s = function() {
                switch (this.anything()) {
                  case "!":
                    return this._or(function() {
                        switch (this.anything()) {
                          case "=":
                            return "!=";

                          default:
                            throw this._fail();
                        }
                    }, function() {
                        return "!";
                    });

                  case "%":
                    return this._or(function() {
                        switch (this.anything()) {
                          case "=":
                            return "%=";

                          default:
                            throw this._fail();
                        }
                    }, function() {
                        return "%";
                    });

                  case "&":
                    return this._or(function() {
                        switch (this.anything()) {
                          case "&":
                            return "&&";

                          case "=":
                            return "&=";

                          default:
                            throw this._fail();
                        }
                    }, function() {
                        return "&";
                    });

                  case "(":
                    return "(";

                  case ")":
                    return ")";

                  case "*":
                    return this._or(function() {
                        switch (this.anything()) {
                          case "=":
                            return "*=";

                          default:
                            throw this._fail();
                        }
                    }, function() {
                        return "*";
                    });

                  case "+":
                    return this._or(function() {
                        switch (this.anything()) {
                          case "+":
                            return "++";

                          case "=":
                            return "+=";

                          default:
                            throw this._fail();
                        }
                    }, function() {
                        return "+";
                    });

                  case ",":
                    return ",";

                  case "-":
                    return this._or(function() {
                        switch (this.anything()) {
                          case "-":
                            return "--";

                          case "=":
                            return "-=";

                          case ">":
                            return "->";

                          default:
                            throw this._fail();
                        }
                    }, function() {
                        return "-";
                    });

                  case ".":
                    return this._or(function() {
                        switch (this.anything()) {
                          case ".":
                            this._applyWithArgs("exactly", ".");
                            return "...";

                          default:
                            throw this._fail();
                        }
                    }, function() {
                        return ".";
                    });

                  case "/":
                    return this._or(function() {
                        switch (this.anything()) {
                          case "=":
                            return "/=";

                          default:
                            throw this._fail();
                        }
                    }, function() {
                        return "/";
                    });

                  case ":":
                    return ":";

                  case ";":
                    return ";";

                  case "<":
                    return this._or(function() {
                        switch (this.anything()) {
                          case "<":
                            return this._or(function() {
                                switch (this.anything()) {
                                  case "=":
                                    return "<<=";

                                  default:
                                    throw this._fail();
                                }
                            }, function() {
                                return "<<";
                            });

                          case "=":
                            return "<=";

                          default:
                            throw this._fail();
                        }
                    }, function() {
                        return "<";
                    });

                  case "=":
                    return this._or(function() {
                        switch (this.anything()) {
                          case "=":
                            return "==";

                          default:
                            throw this._fail();
                        }
                    }, function() {
                        return "=";
                    });

                  case ">":
                    return this._or(function() {
                        switch (this.anything()) {
                          case "=":
                            return ">=";

                          case ">":
                            return this._or(function() {
                                switch (this.anything()) {
                                  case "=":
                                    return ">>=";

                                  default:
                                    throw this._fail();
                                }
                            }, function() {
                                return ">>";
                            });

                          default:
                            throw this._fail();
                        }
                    }, function() {
                        return ">";
                    });

                  case "?":
                    return "?";

                  case "[":
                    return "[";

                  case "]":
                    return "]";

                  case "^":
                    return this._or(function() {
                        switch (this.anything()) {
                          case "=":
                            return "^=";

                          default:
                            throw this._fail();
                        }
                    }, function() {
                        return "^";
                    });

                  case "{":
                    return "{";

                  case "|":
                    return this._or(function() {
                        switch (this.anything()) {
                          case "=":
                            return "|=";

                          case "|":
                            return "||";

                          default:
                            throw this._fail();
                        }
                    }, function() {
                        return "|";
                    });

                  case "}":
                    return "}";

                  case "~":
                    return "~";

                  default:
                    throw this._fail();
                }
            }.call(this);
            return function() {
                console.log("Special:", s);
                return [ s, s ];
            }.call(this);
        },
        scanner: function() {
            var $elf = this, _fromIdx = this.input.idx;
            this._many(function() {
                return this._apply("space");
            });
            return this._or(function() {
                return this._apply("id");
            }, function() {
                return this._apply("num");
            }, function() {
                return this._apply("special");
            }, function() {
                return this._apply("keyword");
            }, function() {
                return this._apply("str");
            });
        },
        token: function(k) {
            var $elf = this, _fromIdx = this.input.idx, t;
            t = this._apply("scanner");
            this._pred(t[0] == k);
            return t[1];
        },
        primary_expr: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                this._applyWithArgs("token", "id");
                return console.log("match id");
            }, function() {
                this._applyWithArgs("token", "const");
                return console.log("match const");
            }, function() {
                this._applyWithArgs("token", "string");
                return console.log("Match String");
            }, function() {
                this._applyWithArgs("token", "(");
                this._apply("expression");
                this._applyWithArgs("token", ")");
                return console.log("match (expr)");
            });
        },
        postfix_expr: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                this._apply("postfix_expr");
                this._applyWithArgs("token", "[");
                this._apply("expression");
                return this._applyWithArgs("token", "]");
            }, function() {
                this._apply("postfix_expr");
                this._applyWithArgs("token", "(");
                this._many(function() {
                    return this._apply("arg_expr_list");
                });
                return this._applyWithArgs("token", ")");
            }, function() {
                this._apply("postfix_expr");
                this._applyWithArgs("token", ".");
                return this._applyWithArgs("token", "id");
            }, function() {
                this._apply("postfix_expr");
                this._applyWithArgs("token", "->");
                return this._applyWithArgs("token", "id");
            }, function() {
                this._apply("postfix_expr");
                return this._applyWithArgs("token", "++");
            }, function() {
                this._apply("postfix_expr");
                return this._applyWithArgs("token", "--");
            }, function() {
                return this._apply("primary_expr");
            });
        },
        arg_expr_list: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                this._apply("arg_expr_list");
                this._applyWithArgs("token", ",");
                this._apply("assign_expr");
                return console.log("2 assign expr");
            }, function() {
                this._apply("assign_expr");
                return console.log("match assign_expr");
            });
        },
        unary_expr: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                this._applyWithArgs("token", "++");
                return this._apply("unary_expr");
            }, function() {
                this._applyWithArgs("token", "--");
                return this._apply("unary_expr");
            }, function() {
                this._apply("unary_operator");
                return this._apply("cast_expr");
            }, function() {
                this._applyWithArgs("token", "sizeof");
                return this._apply("unary_expr");
            }, function() {
                this._applyWithArgs("token", "sizeof");
                this._applyWithArgs("token", "(");
                this._apply("type_name");
                return this._applyWithArgs("token", ")");
            }, function() {
                return this._apply("postfix_expr");
            });
        },
        unary_operator: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                return this._applyWithArgs("token", "&");
            }, function() {
                this._applyWithArgs("token", "*");
                return console.log("Unary *");
            }, function() {
                this._applyWithArgs("token", "+");
                return console.log("Unary +");
            }, function() {
                this._applyWithArgs("token", "-");
                return console.log("Unary -");
            }, function() {
                return this._applyWithArgs("token", "~");
            }, function() {
                return this._applyWithArgs("token", "!");
            });
        },
        cast_expr: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._apply("unary_expr");
        },
        mult_expr: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                this._apply("mult_expr");
                this._applyWithArgs("token", "*");
                return this._apply("cast_expr");
            }, function() {
                this._apply("mult_expr");
                this._applyWithArgs("token", "/");
                return this._apply("cast_expr");
            }, function() {
                this._apply("mult_expr");
                this._applyWithArgs("token", "%");
                return this._apply("cast_expr");
            }, function() {
                return this._apply("cast_expr");
            });
        },
        add_expr: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                this._apply("add_expr");
                this._applyWithArgs("token", "+");
                return this._apply("mult_expr");
            }, function() {
                this._apply("add_expr");
                this._applyWithArgs("token", "-");
                return this._apply("mult_expr");
            }, function() {
                return this._apply("mult_expr");
            });
        },
        shift_expr: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                this._apply("shift_expr");
                this._applyWithArgs("token", "<<");
                return this._apply("add_expr");
            }, function() {
                this._apply("shift_expr");
                this._applyWithArgs("token", ">>");
                return this._apply("add_expr");
            }, function() {
                return this._apply("add_expr");
            });
        },
        relational_expr: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                this._apply("relational_expr");
                this._applyWithArgs("token", "<");
                return this._apply("shift_expr");
            }, function() {
                this._apply("relational_expr");
                this._applyWithArgs("token", ">");
                return this._apply("shift_expr");
            }, function() {
                this._apply("relational_expr");
                this._applyWithArgs("token", "<=");
                return this._apply("shift_expr");
            }, function() {
                this._apply("relational_expr");
                this._applyWithArgs("token", ">=");
                return this._apply("shift_expr");
            }, function() {
                return this._apply("shift_expr");
            });
        },
        equality_expr: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                this._apply("equality_expr");
                this._applyWithArgs("token", "==");
                return this._apply("relational_expr");
            }, function() {
                this._apply("equality_expr");
                this._applyWithArgs("token", "!=");
                return this._apply("relational_expr");
            }, function() {
                return this._apply("relational_expr");
            });
        },
        and_expr: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                this._apply("and_expr");
                this._applyWithArgs("token", "&");
                return this._apply("equality_expr");
            }, function() {
                return this._apply("equality_expr");
            });
        },
        xor_expr: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                this._apply("xor_expr");
                this._applyWithArgs("token", "^");
                return this._apply("and_expr");
            }, function() {
                return this._apply("and_expr");
            });
        },
        ior_expr: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                this._apply("ior_expr");
                this._applyWithArgs("token", "|");
                return this._apply("xor_expr");
            }, function() {
                return this._apply("xor_expr");
            });
        },
        lor_expr: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                this._apply("lor_expr");
                this._applyWithArgs("token", "&&");
                return this._apply("ior_expr");
            }, function() {
                return this._apply("ior_expr");
            });
        },
        cond_expr: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                this._apply("lor_expr");
                this._applyWithArgs("token", "?");
                this._apply("expression");
                this._applyWithArgs("token", ":");
                return this._apply("cond_expr");
            }, function() {
                return this._apply("lor_expr");
            });
        },
        assign_expr: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                this._apply("unary_expr");
                this._apply("assign_op");
                this._apply("assign_expr");
                return console.log("Unary expr");
            }, function() {
                this._apply("cond_expr");
                return console.log("Cond expr");
            });
        },
        assign_op: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                return this._applyWithArgs("token", "=");
            }, function() {
                return this._applyWithArgs("token", "*=");
            }, function() {
                return this._applyWithArgs("token", "/=");
            }, function() {
                return this._applyWithArgs("token", ">>=");
            }, function() {
                return this._applyWithArgs("token", "<<=");
            }, function() {
                return this._applyWithArgs("token", "+=");
            }, function() {
                return this._applyWithArgs("token", "-=");
            }, function() {
                return this._applyWithArgs("token", "%=");
            }, function() {
                return this._applyWithArgs("token", "&=");
            }, function() {
                return this._applyWithArgs("token", "|=");
            }, function() {
                return this._applyWithArgs("token", "^=");
            });
        },
        expression: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                this._apply("expression");
                this._applyWithArgs("token", ",");
                this._apply("assign_expr");
                return console.log("2nd expression");
            }, function() {
                this._apply("assign_expr");
                return console.log("Assign expr");
            });
        },
        const_expr: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._apply("cond_expr");
        },
        declaration: function() {
            var $elf = this, _fromIdx = this.input.idx;
            this._apply("decl_specs");
            this._many(function() {
                return this._apply("init_decl");
            });
            return this._applyWithArgs("token", ";");
        },
        decl_specs: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                this._apply("store_cl_spec");
                return this._many(function() {
                    return this._apply("decl_specs");
                });
            }, function() {
                this._apply("type_spec");
                return this._many(function() {
                    return this._apply("decl_specs");
                });
            }, function() {
                this._apply("type_qualifier");
                return this._many(function() {
                    return this._apply("decl_specs");
                });
            });
        },
        init_decl_list: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._applyWithArgs("listOf", "init_decl", ",");
        },
        init_decl: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                this._apply("declarator");
                this._applyWithArgs("token", "=");
                return this._apply("initializer");
            }, function() {
                return this._apply("declarator");
            });
        },
        store_cl_spec: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                return this._applyWithArgs("token", "typedef");
            }, function() {
                return this._applyWithArgs("token", "extern");
            }, function() {
                return this._applyWithArgs("token", "static");
            }, function() {
                return this._applyWithArgs("token", "auto");
            }, function() {
                return this._applyWithArgs("token", "register");
            });
        },
        type_spec: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                return this._applyWithArgs("token", "void");
            }, function() {
                return this._applyWithArgs("token", "char");
            }, function() {
                return this._applyWithArgs("token", "short");
            }, function() {
                return this._applyWithArgs("token", "int");
            }, function() {
                return this._applyWithArgs("token", "long");
            }, function() {
                return this._applyWithArgs("token", "float");
            }, function() {
                return this._applyWithArgs("token", "double");
            }, function() {
                return this._applyWithArgs("token", "signed");
            }, function() {
                return this._applyWithArgs("token", "unsigned");
            }, function() {
                return this._apply("struct_uni_spec");
            }, function() {
                return this._apply("enum_spec");
            }, function() {
                return this._applyWithArgs("token", "type_name");
            });
        },
        struct_uni_spec: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                this._apply("struct_o_uni");
                this._applyWithArgs("token", "id");
                this._applyWithArgs("token", "{");
                this._apply("struct_decl_lst");
                return this._applyWithArgs("token", "}");
            }, function() {
                this._apply("struct_o_uni");
                this._applyWithArgs("token", "{");
                this._apply("struct_decl_lst");
                return this._applyWithArgs("token", "}");
            }, function() {
                this._apply("struct_o_uni");
                return this._applyWithArgs("token", "id");
            });
        },
        struct_o_uni: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                return this._applyWithArgs("token", "struct");
            }, function() {
                return this._applyWithArgs("token", "union");
            });
        },
        struct_decl_lst: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._many1(function() {
                return this._apply("struct_decl");
            });
        },
        struc_decl: function() {
            var $elf = this, _fromIdx = this.input.idx;
            this._apply("spec_qual_list");
            this._apply("struct_decl_lst");
            return this._applyWithArgs("token", ";");
        },
        spec_qual_list: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                this._apply("type_spec");
                return this._apply("spec_qual_list");
            }, function() {
                return this._apply("type_spec");
            }, function() {
                this._apply("type_qualifier");
                return this._apply("spec_qual_list");
            }, function() {
                return this._apply("type_qualifier");
            });
        },
        struc_declr_lst: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._applyWithArgs("listOf", "struct_declr", ",");
        },
        struct_declr: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                this._apply("declarator");
                this._applyWithArgs("token", ":");
                return this._apply("const_expr");
            }, function() {
                this._applyWithArgs("token", ":");
                return this._apply("const_expr");
            }, function() {
                return this._apply("declarator");
            });
        },
        enum_spec: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                this._applyWithArgs("token", "enum");
                this._applyWithArgs("token", "id");
                this._applyWithArgs("token", "{");
                this._apply("enumratr_lst");
                return this._applyWithArgs("token", "}");
            }, function() {
                this._applyWithArgs("token", "enum");
                this._applyWithArgs("token", "{");
                this._apply("enumratr_lst");
                return this._applyWithArgs("token", "}");
            }, function() {
                this._applyWithArgs("token", "enum");
                return this._applyWithArgs("token", "id");
            });
        },
        enumratr_lst: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._applyWithArgs("listOf", "enumerator", ",");
        },
        enumerator: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                this._applyWithArgs("token", "id");
                this._applyWithArgs("token", "=");
                return this._apply("const_expr");
            }, function() {
                return this._applyWithArgs("token", "id");
            });
        },
        type_qualifier: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                return this._applyWithArgs("token", "const");
            }, function() {
                return this._applyWithArgs("token", "volatile");
            });
        },
        declarator: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                this._apply("pointer");
                return this._apply("dir_declarator");
            }, function() {
                return this._apply("dir_declarator");
            });
        },
        dir_declarator: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                this._apply("dir_declarator");
                this._applyWithArgs("token", "[");
                this._apply("const_expr");
                return this._applyWithArgs("token", "]");
            }, function() {
                this._apply("dir_declarator");
                this._applyWithArgs("token", "[");
                return this._applyWithArgs("token", "]");
            }, function() {
                this._apply("dir_declarator");
                this._applyWithArgs("token", "(");
                this._apply("param_type_lst");
                return this._applyWithArgs("token", ")");
            }, function() {
                this._apply("dir_declarator");
                this._applyWithArgs("token", "(");
                this._apply("ident_lst");
                return this._applyWithArgs("token", ")");
            }, function() {
                this._apply("dir_declarator");
                this._applyWithArgs("token", "(");
                return this._applyWithArgs("token", ")");
            }, function() {
                this._applyWithArgs("token", "(");
                this._apply("declarator");
                return this._applyWithArgs("token", ")");
            }, function() {
                return this._applyWithArgs("token", "id");
            });
        },
        pointer: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                this._applyWithArgs("token", "*");
                this._apply("type_qual_list");
                return this._apply("pointer");
            }, function() {
                this._applyWithArgs("token", "*");
                return this._apply("type_qual_list");
            }, function() {
                this._applyWithArgs("token", "*");
                return this._apply("pointer");
            }, function() {
                return this._applyWithArgs("token", "*");
            });
        },
        type_qual_list: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._many1(function() {
                return this._apply("type_qualifier");
            });
        },
        param_type_lst: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                this._apply("param_list");
                this._applyWithArgs("token", ",");
                return this._applyWithArgs("token", "...");
            }, function() {
                return this._apply("param_list");
            });
        },
        param_list: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                this._apply("param_list");
                this._applyWithArgs("token", ",");
                return this._apply("param_decl");
            }, function() {
                return this._apply("param_decl");
            });
        },
        param_decl: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                this._apply("decl_specs");
                return this._apply("declarator");
            }, function() {
                this._apply("decl_specs");
                return this._apply("abstract_decl");
            }, function() {
                return this._apply("decl_specs");
            });
        },
        ident_list: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                this._apply("ident_list");
                this._applyWithArgs("token", ",");
                return this._applyWithArgs("token", "id");
            }, function() {
                return this._applyWithArgs("token", "id");
            });
        },
        type_name: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                this._apply("spec_qual_lst");
                return this._apply("abstract_decl");
            }, function() {
                return this._apply("spec_qual_lst");
            });
        },
        abstract_decl: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                this._apply("pointer");
                return this._apply("dir_abs_declr");
            }, function() {
                return this._apply("dir_abs_declr");
            }, function() {
                return this._apply("pointer");
            });
        },
        dir_abs_declr: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                this._applyWithArgs("token", "(");
                this._apply("abstract_decl");
                return this._applyWithArgs("token", ")");
            }, function() {
                this._applyWithArgs("token", "[");
                this._apply("const_expr");
                return this._applyWithArgs("token", "]");
            }, function() {
                this._applyWithArgs("token", "[");
                return this._applyWithArgs("token", "]");
            }, function() {
                this._apply("dir_abs_declr");
                this._applyWithArgs("token", "[");
                this._apply("const_expr");
                return this._applyWithArgs("token", "]");
            }, function() {
                this._apply("dir_abs_declr");
                this._applyWithArgs("token", "[");
                return this._applyWithArgs("token", "]");
            }, function() {
                this._applyWithArgs("token", "(");
                this._apply("param_type_lst");
                return this._applyWithArgs("token", ")");
            }, function() {
                this._applyWithArgs("token", "(");
                return this._applyWithArgs("token", ")");
            }, function() {
                this._apply("dir_abs_declr");
                this._applyWithArgs("token", "(");
                this._apply("param_type_lst");
                return this._applyWithArgs("token", ")");
            }, function() {
                this._apply("dir_abs_declr");
                this._applyWithArgs("token", "(");
                return this._applyWithArgs("token", ")");
            });
        },
        initializer: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                this._applyWithArgs("token", "{");
                this._applyWithArgs("listOf", "initializer_lst", ",");
                return this._applyWithArgs("token", "}");
            }, function() {
                return this._apply("assign_expr");
            });
        },
        initializer_lst: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._applyWithArgs("listOf", "initializer", ",");
        },
        statement: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                this._apply("labeled_stmt");
                return console.log("Labeled stmt");
            }, function() {
                this._apply("compound_stmt");
                return console.log("Compound stmt");
            }, function() {
                this._apply("expression_stmt");
                return console.log("Expression stmt");
            }, function() {
                this._apply("selection_stmt");
                return console.log("Selection stmt");
            }, function() {
                this._apply("iteration_stmt");
                return console.log("Iteration stmt");
            }, function() {
                this._apply("jump_stmt");
                return console.log("Jump stmt");
            });
        },
        labeled_stmt: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                this._applyWithArgs("token", "id");
                this._applyWithArgs("token", ":");
                return this._apply("statement");
            }, function() {
                this._applyWithArgs("token", "case");
                this._apply("const_expression");
                this._applyWithArgs("token", ":");
                return this._apply("statement");
            }, function() {
                this._applyWithArgs("token", "default");
                this._applyWithArgs("token", ":");
                return this._apply("statement");
            });
        },
        compound_stmt: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                this._applyWithArgs("token", "{");
                this._apply("declaration_lst");
                this._apply("statement_lst");
                return this._applyWithArgs("token", "}");
            }, function() {
                this._applyWithArgs("token", "{");
                this._apply("statement_lst");
                return this._applyWithArgs("token", "}");
            }, function() {
                this._applyWithArgs("token", "{");
                this._apply("declaration_lst");
                return this._applyWithArgs("token", "}");
            }, function() {
                this._applyWithArgs("token", "{");
                return this._applyWithArgs("token", "}");
            });
        },
        declaration_lst: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                this._apply("declaration_lst");
                return this._apply("declaration");
            }, function() {
                return this._apply("declaration");
            });
        },
        statement_lst: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._many1(function() {
                return this._apply("statement");
            });
        },
        expression_stmt: function() {
            var $elf = this, _fromIdx = this.input.idx;
            this._many(function() {
                return this._apply("expression");
            });
            return this._applyWithArgs("token", ";");
        },
        selection_stmt: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                this._applyWithArgs("token", "if");
                this._applyWithArgs("token", "(");
                this._apply("expression");
                this._applyWithArgs("token", ")");
                this._apply("statement");
                this._applyWithArgs("token", "else");
                return this._apply("statement");
            }, function() {
                this._applyWithArgs("token", "if");
                this._applyWithArgs("token", "(");
                this._apply("expression");
                this._applyWithArgs("token", ")");
                return this._apply("statement");
            }, function() {
                this._applyWithArgs("token", "switch");
                this._applyWithArgs("token", "(");
                this._apply("expression");
                this._applyWithArgs("token", ")");
                return this._apply("statement");
            });
        },
        iteration_stmt: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                this._applyWithArgs("token", "while");
                this._applyWithArgs("token", "(");
                this._apply("expression");
                this._applyWithArgs("token", ")");
                this._apply("statement");
                return console.log("While! ");
            }, function() {
                this._applyWithArgs("token", "do");
                this._apply("statement");
                this._applyWithArgs("token", "while");
                this._applyWithArgs("token", "(");
                this._apply("expression");
                this._applyWithArgs("token", ")");
                return this._applyWithArgs("token", ";");
            }, function() {
                this._applyWithArgs("token", "for");
                this._applyWithArgs("token", "(");
                this._apply("expression_stmt");
                this._apply("expression_stmt");
                this._applyWithArgs("token", ")");
                return this._apply("statement");
            }, function() {
                this._applyWithArgs("token", "for");
                this._applyWithArgs("token", "(");
                this._apply("expression_stmt");
                this._apply("expression_stmt");
                this._apply("expression");
                this._applyWithArgs("token", ")");
                return this._apply("statement");
            });
        },
        jump_stmt: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                this._applyWithArgs("token", "goto");
                this._applyWithArgs("token", "id");
                return this._applyWithArgs("token", ";");
            }, function() {
                this._applyWithArgs("token", "continue");
                return this._applyWithArgs("token", ";");
            }, function() {
                this._applyWithArgs("token", "break");
                return this._applyWithArgs("token", ";");
            }, function() {
                this._applyWithArgs("token", "return");
                return this._applyWithArgs("token", ";");
            }, function() {
                this._applyWithArgs("token", "return");
                this._apply("expression");
                return this._applyWithArgs("token", ";");
            });
        },
        translation_u: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._many1(function() {
                return this._apply("external_decl");
            });
        },
        external_decl: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                this._apply("function_def");
                return console.log("Function def");
            }, function() {
                return this._apply("declaration");
            });
        },
        function_def: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                this._apply("decl_specs");
                this._apply("declarator");
                this._apply("declaration_lst");
                return this._apply("compound_stmt");
            }, function() {
                this._apply("decl_specs");
                this._apply("declarator");
                return this._apply("compound_stmt");
            }, function() {
                this._apply("declarator");
                this._apply("declaration_lst");
                return this._apply("compound_stmt");
            }, function() {
                this._apply("declarator");
                return this._apply("compound_stmt");
            });
        },
        top: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._apply("translation_u");
        }
    });
    CParser.keywords = {};
    keywords = [ "auto", "break", "case", "char", "const", "continue", "default", "do", "double", "else", "enum", "extern", "float", "for", "goto", "if", "int", "long", "register", "return", "short", "signed", "sizeof", "static", "struct", "switch", "typedef", "union", "unsigned", "void", "volatile", "while" ];
    for (var idx = 0; idx < keywords.length; idx++) CParser.keywords[keywords[idx]] = !0;
    CParser._isKeyword = function(k) {
        return this.keywords.hasOwnProperty(k);
    };
    var rl = readline.createInterface(process.stdin, process.stdout);
    rl.setPrompt("CParser > ");
    rl.prompt();
    rl.on("line", function(line) {
        "right" === line && rl.close();
        try {
            tree = CParser.matchAll(line, "top");
        } catch (e) {
            console.log("				 ERROR! Invalid Input");
        } finally {}
        rl.prompt();
    }).on("close", function() {
        process.exit(0);
    });
});