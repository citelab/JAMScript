!function(root, factory) {
    "function" == typeof define && define.amd ? define([ "require", "exports", "ometa-core", "../nodes.js" ], factory) : "object" == typeof exports ? factory(require, exports, require("ometa-js").core) : factory(function(moduleName) {
        return root[moduleName];
    }, root, root.OMeta);
}(this, function(require, exports, OMeta) {
    var __ = require("../nodes.js"), CParser = OMeta._extend({
        isKeyword: function(x) {
            var $elf = this, _fromIdx = this.input.idx;
            return this._pred(this.spec.isKeyword(x));
        },
        nameFirst: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                return OMeta._superApplyWithArgs(this, "letter");
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
                return OMeta._superApplyWithArgs(this, "digit");
            });
        },
        linebreak: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._applyWithArgs("exactly", "\n");
        },
        comment: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                switch (this.anything()) {
                  case "/":
                    this._applyWithArgs("exactly", "/");
                    this._many(function() {
                        this._not(function() {
                            return this._apply("linebreak");
                        });
                        return this._apply("char");
                    });
                    return this._lookahead(function() {
                        return this._apply("linebreak");
                    });

                  default:
                    throw this._fail();
                }
            }, function() {
                return this._applyWithArgs("fromTo", "/*", "*/");
            });
        },
        space: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                return OMeta._superApplyWithArgs(this, "space");
            }, function() {
                return this._apply("comment");
            }, function() {
                return this._apply("linebreak");
            });
        },
        spacesNoNl: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._many(function() {
                this._not(function() {
                    return this._apply("linebreak");
                });
                return this._apply("space");
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
            return __.Id(name);
        },
        keyword: function() {
            var $elf = this, _fromIdx = this.input.idx, kwd;
            kwd = this._apply("iName");
            this._applyWithArgs("isKeyword", kwd);
            return __.Keyword(kwd);
        },
        hexDigit: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                return OMeta._superApplyWithArgs(this, "digit");
            }, function() {
                return this._applyWithArgs("range", "a", "f");
            }, function() {
                return this._applyWithArgs("range", "A", "F");
            });
        },
        hex: function() {
            var $elf = this, _fromIdx = this.input.idx, d;
            d = this._consumedBy(function() {
                switch (this.anything()) {
                  case "0":
                    switch (this.anything()) {
                      case "X":
                        return this._many1(function() {
                            return this._apply("hexDigit");
                        });

                      case "x":
                        return "0x";

                      default:
                        throw this._fail();
                    }

                  default:
                    throw this._fail();
                }
            });
            return __.Number(parseInt(d)).kind("hex");
        },
        decimalInt: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                switch (this.anything()) {
                  case "0":
                    return "0";

                  default:
                    throw this._fail();
                }
            }, function() {
                this._not(function() {
                    return this._applyWithArgs("exactly", "0");
                });
                this._apply("digit");
                return this._many(function() {
                    return this._apply("digit");
                });
            });
        },
        expPart: function() {
            var $elf = this, _fromIdx = this.input.idx;
            (function() {
                switch (this.anything()) {
                  case "E":
                    return "E";

                  case "e":
                    return "e";

                  default:
                    throw this._fail();
                }
            }).call(this);
            this._opt(function() {
                switch (this.anything()) {
                  case "+":
                    return "+";

                  case "-":
                    return "-";

                  default:
                    throw this._fail();
                }
            });
            return this._many1(function() {
                return this._apply("digit");
            });
        },
        octal: function() {
            var $elf = this, _fromIdx = this.input.idx, d;
            d = this._consumedBy(function() {
                this._applyWithArgs("exactly", "0");
                return this._many1(function() {
                    return this._apply("digit");
                });
            });
            return __.Number(parseInt(d, 8)).kind("oct");
        },
        decimal: function() {
            var $elf = this, _fromIdx = this.input.idx, f;
            return this._or(function() {
                f = this._consumedBy(function() {
                    this._opt(function() {
                        return this._applyWithArgs("exactly", "-");
                    });
                    this._apply("decimalInt");
                    this._opt(function() {
                        this._applyWithArgs("exactly", ".");
                        return this._many1(function() {
                            return this._apply("digit");
                        });
                    });
                    return this._opt(function() {
                        return this._apply("expPart");
                    });
                });
                return __.Number(f).kind("float");
            }, function() {
                f = this._consumedBy(function() {
                    this._opt(function() {
                        return this._applyWithArgs("exactly", "-");
                    });
                    this._applyWithArgs("exactly", ".");
                    this._many1(function() {
                        return this._apply("digit");
                    });
                    return this._opt(function() {
                        return this._apply("expPart");
                    });
                });
                return __.Number(f).kind("float");
            });
        },
        integer: function() {
            var $elf = this, _fromIdx = this.input.idx, d;
            d = this._consumedBy(function() {
                this._opt(function() {
                    return this._applyWithArgs("exactly", "-");
                });
                return this._apply("decimalInt");
            });
            return __.Number(parseInt(d)).kind("int");
        },
        number: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                return this._apply("hex");
            }, function() {
                return this._apply("octal");
            }, function() {
                return this._apply("decimal");
            }, function() {
                return this._apply("integer");
            });
        },
        escapeChar: function() {
            var $elf = this, _fromIdx = this.input.idx, c;
            c = this._consumedBy(function() {
                this._applyWithArgs("exactly", "\\");
                return this._apply("char");
            });
            return unescape(c);
        },
        string: function() {
            var $elf = this, _fromIdx = this.input.idx, cs, n;
            return this._or(function() {
                switch (this.anything()) {
                  case '"':
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
                    return __.String(cs.join(""));

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
                return __.String(cs.join(""));
            });
        },
        punctuator: function() {
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
            return __.Punctuator(s);
        },
        token: function(tt) {
            var $elf = this, _fromIdx = this.input.idx, t;
            this._apply("spaces");
            return this._or(function() {
                t = this._or(function() {
                    return this._apply("punctuator");
                }, function() {
                    return this._apply("keyword");
                });
                this._pred(t.value() == tt);
                return t;
            }, function() {
                t = this._or(function() {
                    return this._apply("id");
                }, function() {
                    return this._apply("number");
                }, function() {
                    return this._apply("string");
                });
                this._pred(t[0] == tt);
                return t;
            });
        },
        listof: function(p) {
            var $elf = this, _fromIdx = this.input.idx, x, y;
            x = this._applyWithArgs("apply", p);
            y = this._many(function() {
                this._applyWithArgs("token", ",");
                return this._applyWithArgs("apply", p);
            });
            return function() {
                y.unshift(x);
                return y;
            }.call(this);
        },
        expr: function() {
            var $elf = this, _fromIdx = this.input.idx, le;
            le = this._applyWithArgs("listof", "assign_expr");
            return le.length > 1 ? __.SequenceExpr(le) : le[0];
        },
        assign_expr: function() {
            var $elf = this, _fromIdx = this.input.idx, lhs, op, rhs;
            return this._or(function() {
                lhs = this._apply("unary_expr");
                op = this._apply("assign_op");
                rhs = this._apply("assign_expr");
                return __.AssignExpr(lhs, rhs).operator(op.value());
            }, function() {
                return this._apply("cond_expr");
            });
        },
        cond_expr: function() {
            var $elf = this, _fromIdx = this.input.idx, e, f, t;
            return this._or(function() {
                e = this._apply("lor_expr");
                this._applyWithArgs("token", "?");
                t = this._apply("expr");
                this._applyWithArgs("token", ":");
                f = this._apply("cond_expr");
                return __.CondExpr(e, t, f);
            }, function() {
                return this._apply("lor_expr");
            });
        },
        lor_expr: function() {
            var $elf = this, _fromIdx = this.input.idx, x, y;
            return this._or(function() {
                x = this._apply("lor_expr");
                this._applyWithArgs("token", "||");
                y = this._apply("lar_expr");
                return __.BinaryExpr(x, y).operator("||");
            }, function() {
                return this._apply("lar_expr");
            });
        },
        lar_expr: function() {
            var $elf = this, _fromIdx = this.input.idx, x, y;
            return this._or(function() {
                x = this._apply("lar_expr");
                this._applyWithArgs("token", "&&");
                y = this._apply("ior_expr");
                return __.BinaryExpr(x, y).operator("&&");
            }, function() {
                return this._apply("ior_expr");
            });
        },
        ior_expr: function() {
            var $elf = this, _fromIdx = this.input.idx, x, y;
            return this._or(function() {
                x = this._apply("ior_expr");
                this._applyWithArgs("token", "|");
                y = this._apply("xor_expr");
                return __.BinaryExpr(x, y).operator("|");
            }, function() {
                return this._apply("xor_expr");
            });
        },
        xor_expr: function() {
            var $elf = this, _fromIdx = this.input.idx, x, y;
            return this._or(function() {
                x = this._apply("xor_expr");
                this._applyWithArgs("token", "^");
                y = this._apply("and_expr");
                return __.BinaryExpr(x, y).operator("^");
            }, function() {
                return this._apply("and_expr");
            });
        },
        and_expr: function() {
            var $elf = this, _fromIdx = this.input.idx, x, y;
            return this._or(function() {
                x = this._apply("and_expr");
                this._applyWithArgs("token", "&");
                y = this._apply("eq_expr");
                return __.BinaryExpr(x, y).operator("&");
            }, function() {
                return this._apply("eq_expr");
            });
        },
        eq_expr: function() {
            var $elf = this, _fromIdx = this.input.idx, op, x, y;
            return this._or(function() {
                x = this._apply("eq_expr");
                op = this._or(function() {
                    return this._applyWithArgs("token", "==");
                }, function() {
                    return this._applyWithArgs("token", "!=");
                });
                y = this._apply("rel_expr");
                return __.BinaryExpr(x, y).operator(op.value());
            }, function() {
                return this._apply("rel_expr");
            });
        },
        rel_expr: function() {
            var $elf = this, _fromIdx = this.input.idx, op, x, y;
            return this._or(function() {
                x = this._apply("rel_expr");
                op = this._or(function() {
                    return this._applyWithArgs("token", "<=");
                }, function() {
                    return this._applyWithArgs("token", "<");
                }, function() {
                    return this._applyWithArgs("token", ">=");
                }, function() {
                    return this._applyWithArgs("token", ">");
                });
                y = this._apply("shift_expr");
                return __.BinaryExpr(x, y).operator(op.value());
            }, function() {
                return this._apply("shift_expr");
            });
        },
        shift_expr: function() {
            var $elf = this, _fromIdx = this.input.idx, op, x, y;
            return this._or(function() {
                x = this._apply("shift_expr");
                op = this._or(function() {
                    return this._applyWithArgs("token", "<<");
                }, function() {
                    return this._applyWithArgs("token", ">>");
                });
                y = this._apply("add_expr");
                return __.BinaryExpr(x, y).operator(op.value());
            }, function() {
                return this._apply("add_expr");
            });
        },
        add_expr: function() {
            var $elf = this, _fromIdx = this.input.idx, op, x, y;
            return this._or(function() {
                x = this._apply("add_expr");
                op = this._or(function() {
                    return this._applyWithArgs("token", "+");
                }, function() {
                    return this._applyWithArgs("token", "-");
                });
                y = this._apply("mult_expr");
                return __.BinaryExpr(x, y).operator(op.value());
            }, function() {
                return this._apply("mult_expr");
            });
        },
        mult_expr: function() {
            var $elf = this, _fromIdx = this.input.idx, op, x, y;
            return this._or(function() {
                x = this._apply("mult_expr");
                op = this._or(function() {
                    return this._applyWithArgs("token", "*");
                }, function() {
                    return this._applyWithArgs("token", "/");
                }, function() {
                    return this._applyWithArgs("token", "%");
                });
                y = this._apply("prefix_expr");
                return __.BinaryExpr(x, y).operator(op.value());
            }, function() {
                return this._apply("prefix_expr");
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
        prefix_expr: function() {
            var $elf = this, _fromIdx = this.input.idx, e, op;
            return this._or(function() {
                op = this._or(function() {
                    return this._applyWithArgs("token", "++");
                }, function() {
                    return this._applyWithArgs("token", "--");
                });
                this._apply("spacesNoNl");
                e = this._apply("unary_expr");
                return __.UpdateExpr(e).operator(op.value());
            }, function() {
                return this._apply("unary_expr");
            });
        },
        unary_expr: function() {
            var $elf = this, _fromIdx = this.input.idx, e, op;
            return this._or(function() {
                op = this._or(function() {
                    return this._applyWithArgs("token", "&");
                }, function() {
                    return this._applyWithArgs("token", "*");
                }, function() {
                    return this._applyWithArgs("token", "+");
                }, function() {
                    return this._applyWithArgs("token", "-");
                }, function() {
                    return this._applyWithArgs("token", "~");
                }, function() {
                    return this._applyWithArgs("token", "!");
                });
                e = this._apply("prefix_expr");
                return __.UnaryExpr(e).operator(op.value());
            }, function() {
                this._applyWithArgs("token", "sizeof");
                return e = this._apply("unary_expr");
            }, function() {
                return this._apply("postfix_expr");
            });
        },
        postfix_expr: function() {
            var $elf = this, _fromIdx = this.input.idx, e, op;
            return this._or(function() {
                e = this._apply("left_expr");
                this._apply("spacesNoNl");
                op = this._or(function() {
                    return this._applyWithArgs("token", "++");
                }, function() {
                    return this._applyWithArgs("token", "--");
                });
                return __.UpdateExpr(e).operator(op.value()).prefix(!1);
            }, function() {
                return this._apply("left_expr");
            });
        },
        left_expr: function() {
            var $elf = this, _fromIdx = this.input.idx, p;
            return this._or(function() {
                p = this._apply("left_expr");
                return this._applyWithArgs("call_expr", p);
            }, function() {
                p = this._apply("left_expr");
                return this._applyWithArgs("member_expr", p);
            }, function() {
                return this._apply("primary_expr");
            });
        },
        call_expr: function(p) {
            var $elf = this, _fromIdx = this.input.idx, as;
            this._applyWithArgs("token", "(");
            as = this._applyWithArgs("listOf", "assign_expr", ",");
            this._applyWithArgs("token", ")");
            return __.CallExpr(p, as);
        },
        member_expr: function(p) {
            var $elf = this, _fromIdx = this.input.idx, e, i;
            return this._or(function() {
                this._applyWithArgs("token", "[");
                e = this._apply("expr");
                this._applyWithArgs("token", "]");
                return __.MemberExpr(p, e);
            }, function() {
                this._applyWithArgs("token", ".");
                i = this._applyWithArgs("token", "Id");
                return __.MemberExpr(p).name(i.value());
            }, function() {
                this._applyWithArgs("token", "->");
                i = this._applyWithArgs("token", "Id");
                return __.PointerExpr(p).name(i.value());
            });
        },
        primary_expr: function() {
            var $elf = this, _fromIdx = this.input.idx, e;
            return this._or(function() {
                return this._applyWithArgs("token", "Id");
            }, function() {
                return this._applyWithArgs("token", "Number");
            }, function() {
                return this._applyWithArgs("token", "String");
            }, function() {
                this._applyWithArgs("token", "(");
                e = this._apply("expr");
                this._applyWithArgs("token", ")");
                return __.GroupExpr(e);
            });
        },
        const_expr: function() {
            var $elf = this, _fromIdx = this.input.idx, e;
            e = this._apply("cond_expr");
            return e;
        },
        declaration: function() {
            var $elf = this, _fromIdx = this.input.idx, ds, idec;
            ds = this._apply("decl_specs");
            idec = this._apply("init_decl_lst");
            this._applyWithArgs("token", ";");
            return __.Declaration(ds, idec);
        },
        decl_specs: function() {
            var $elf = this, _fromIdx = this.input.idx, s;
            s = this._many1(function() {
                return this._or(function() {
                    return this._apply("store_cl_spec");
                }, function() {
                    return this._apply("type_spec");
                }, function() {
                    return this._apply("type_qualifier");
                });
            });
            return __.DeclSpec(s);
        },
        init_decl_lst: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._applyWithArgs("listOf", "init_decl", ",");
        },
        init_decl: function() {
            var $elf = this, _fromIdx = this.input.idx, d, i;
            return this._or(function() {
                d = this._apply("declarator");
                this._applyWithArgs("token", "=");
                i = this._apply("initializer");
                return __.InitDecl(d, i);
            }, function() {
                d = this._apply("declarator");
                return __.InitDecl(d);
            });
        },
        store_cl_spec: function() {
            var $elf = this, _fromIdx = this.input.idx, s;
            s = this._or(function() {
                return this._applyWithArgs("token", "extern");
            }, function() {
                return this._applyWithArgs("token", "static");
            }, function() {
                return this._applyWithArgs("token", "auto");
            }, function() {
                return this._applyWithArgs("token", "register");
            });
            return __.StorageClassSpec()["class"](s.value());
        },
        type_spec: function() {
            var $elf = this, _fromIdx = this.input.idx, e, s;
            return this._or(function() {
                s = this._or(function() {
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
                });
                return __.TypeSpec().type(s.value());
            }, function() {
                e = this._apply("enum_spec");
                return __.TypeSpec(e).type("enum");
            }, function() {
                e = this._apply("struct_spec");
                return __.TypeSpec(e).type("struct");
            }, function() {
                e = this._apply("union_spec");
                return __.TypeSpec(e).type("union");
            });
        },
        struct_spec: function() {
            var $elf = this, _fromIdx = this.input.idx, l, s;
            return this._or(function() {
                this._applyWithArgs("token", "struct");
                s = this._applyWithArgs("token", "Id");
                this._applyWithArgs("token", "{");
                l = this._many1(function() {
                    return this._apply("struct_decl");
                });
                this._applyWithArgs("token", "}");
                return __.StrucSpec(l).name(s.value());
            }, function() {
                this._applyWithArgs("token", "struct");
                s = this._applyWithArgs("token", "Id");
                return __.StrucSpec().name(s.value());
            }, function() {
                this._applyWithArgs("token", "struct");
                this._applyWithArgs("token", "{");
                l = this._many1(function() {
                    return this._apply("struct_decl");
                });
                this._applyWithArgs("token", "}");
                return __.StrucSpec(l);
            });
        },
        union_spec: function() {
            var $elf = this, _fromIdx = this.input.idx, l, s;
            return this._or(function() {
                this._applyWithArgs("token", "union");
                s = this._applyWithArgs("token", "Id");
                this._applyWithArgs("token", "{");
                l = this._many1(function() {
                    return this._apply("struct_decl");
                });
                this._applyWithArgs("token", "}");
                return __.UnionSpec(l).name(s.value());
            }, function() {
                this._applyWithArgs("token", "union");
                s = this._applyWithArgs("token", "Id");
                return __.UnionSpec().name(s.value());
            }, function() {
                this._applyWithArgs("token", "union");
                this._applyWithArgs("token", "{");
                l = this._many1(function() {
                    return this._apply("struct_decl");
                });
                this._applyWithArgs("token", "}");
                return __.UnionSpec(l);
            });
        },
        struct_decl: function() {
            var $elf = this, _fromIdx = this.input.idx, l, s;
            s = this._apply("spec_qual_list");
            l = this._applyWithArgs("listOf", "sdeclarator", ",");
            this._applyWithArgs("token", ";");
            return __.StrucDecl(s, l);
        },
        spec_qual_list: function() {
            var $elf = this, _fromIdx = this.input.idx, l;
            l = this._many1(function() {
                return this._or(function() {
                    return this._apply("type_spec");
                }, function() {
                    return this._apply("type_qualifier");
                });
            });
            return __.SpecQList(l);
        },
        sdeclarator: function() {
            var $elf = this, _fromIdx = this.input.idx, d, e;
            return this._or(function() {
                d = this._apply("declarator");
                this._applyWithArgs("token", ":");
                e = this._apply("const_expr");
                return __.SDeclarator(d, e);
            }, function() {
                d = this._apply("declarator");
                return __.SDeclarator(d);
            }, function() {
                this._applyWithArgs("token", ":");
                e = this._apply("const_expr");
                return __.SDeclarator(e);
            });
        },
        enum_spec: function() {
            var $elf = this, _fromIdx = this.input.idx, e, s;
            return this._or(function() {
                this._applyWithArgs("token", "enum");
                s = this._applyWithArgs("token", "Id");
                this._applyWithArgs("token", "{");
                e = this._applyWithArgs("listOf", "enumerator", ",");
                this._applyWithArgs("token", "}");
                return __.EnumDeclaration(e).name(s.value());
            }, function() {
                this._applyWithArgs("token", "enum");
                s = this._applyWithArgs("token", "Id");
                return __.EnumDeclaration().name(s.value());
            }, function() {
                this._applyWithArgs("token", "enum");
                this._applyWithArgs("token", "{");
                e = this._applyWithArgs("listOf", "enumerator", ",");
                this._applyWithArgs("token", "}");
                return __.EnumDeclaration(e);
            });
        },
        enumerator: function() {
            var $elf = this, _fromIdx = this.input.idx, e, s;
            return this._or(function() {
                s = this._applyWithArgs("token", "Id");
                this._applyWithArgs("token", "=");
                e = this._apply("const_expr");
                return __.Enumerator(e).name(s.value());
            }, function() {
                s = this._applyWithArgs("token", "Id");
                return __.Enumerator().name(s.value());
            });
        },
        type_qualifier: function() {
            var $elf = this, _fromIdx = this.input.idx, e;
            e = this._or(function() {
                return this._applyWithArgs("token", "const");
            }, function() {
                return this._applyWithArgs("token", "volatile");
            });
            return __.TypeQual().type(e.value());
        },
        declarator: function() {
            var $elf = this, _fromIdx = this.input.idx, d, p;
            return this._or(function() {
                p = this._apply("pointer");
                d = this._apply("dir_declarator");
                return function() {
                    d.set(p);
                    return d;
                }.call(this);
            }, function() {
                return this._apply("dir_declarator");
            });
        },
        dir_declarator: function() {
            var $elf = this, _fromIdx = this.input.idx, d, s;
            return this._or(function() {
                d = this._apply("dir_declarator");
                return this._applyWithArgs("pmember_decl", d);
            }, function() {
                d = this._apply("dir_declarator");
                return this._applyWithArgs("pcall_decl", d);
            }, function() {
                this._applyWithArgs("token", "(");
                d = this._apply("declarator");
                this._applyWithArgs("token", ")");
                return function() {
                    d.type("func");
                    return d;
                }.call(this);
            }, function() {
                s = this._applyWithArgs("token", "Id");
                return __.Declarator().name(s.value());
            });
        },
        pmember_decl: function(p) {
            var $elf = this, _fromIdx = this.input.idx, e;
            return this._or(function() {
                this._applyWithArgs("token", "[");
                e = this._apply("const_expr");
                this._applyWithArgs("token", "]");
                return function() {
                    p.type("member");
                    p.append(e);
                    return p;
                }.call(this);
            }, function() {
                this._applyWithArgs("token", "[");
                this._apply("empty");
                this._applyWithArgs("token", "]");
                return function() {
                    p.type("member");
                    return p;
                }.call(this);
            });
        },
        pcall_decl: function(p) {
            var $elf = this, _fromIdx = this.input.idx, ll, pl;
            this._applyWithArgs("token", "(");
            this._or(function() {
                this._lookahead(function() {
                    return this._apply("keyword");
                });
                pl = this._apply("param_type_lst");
                return function() {
                    p.type("call");
                    p.appendAll(pl);
                    return p;
                }.call(this);
            }, function() {
                ll = this._apply("ident_list");
                return function() {
                    p.type("call");
                    p.appendAll(ll);
                    return p;
                }.call(this);
            }, function() {
                return this._apply("empty");
            });
            this._applyWithArgs("token", ")");
            return function() {
                p.type("call");
                return p;
            }.call(this);
        },
        pointer: function() {
            var $elf = this, _fromIdx = this.input.idx, pn, pt;
            pn = this._many1(function() {
                return this._applyWithArgs("token", "*");
            });
            pt = this._opt(function() {
                return this._or(function() {
                    return this._applyWithArgs("token", "const");
                }, function() {
                    return this._applyWithArgs("token", "volatile");
                });
            });
            return {
                pointer_level: pn.length,
                pointer_type: void 0 === pt ? pt : pt.value()
            };
        },
        ident_list: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._applyWithArgs("listOf", "id", ",");
        },
        param_type_lst: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._applyWithArgs("listOf", "param_decl", ",");
        },
        abs_declarator: function() {
            var $elf = this, _fromIdx = this.input.idx, d, p;
            return this._or(function() {
                p = this._apply("pointer");
                d = this._apply("dir_abs_declarator");
                return function() {
                    d.set(p);
                    return d;
                }.call(this);
            }, function() {
                p = this._apply("pointer");
                return __.ADeclarator(p);
            }, function() {
                d = this._apply("dir_abs_declarator");
                return d;
            });
        },
        dir_abs_declarator: function() {
            var $elf = this, _fromIdx = this.input.idx, a, d, e, l;
            return this._or(function() {
                this._applyWithArgs("token", "(");
                a = this._apply("abs_declarator");
                this._applyWithArgs("token", ")");
                return __.ADeclarator(a).type("func");
            }, function() {
                this._applyWithArgs("token", "(");
                l = this._apply("param_type_lst");
                this._applyWithArgs("token", ")");
                return __.ADeclarator(l).type("func");
            }, function() {
                this._applyWithArgs("token", "(");
                this._applyWithArgs("token", ")");
                return __.ADeclarator().type("func");
            }, function() {
                this._applyWithArgs("token", "[");
                e = this._apply("const_expr");
                this._applyWithArgs("token", "]");
                return __.ADeclarator(e).type("member");
            }, function() {
                this._applyWithArgs("token", "[");
                this._applyWithArgs("token", "]");
                return __.ADeclarator().type("member");
            }, function() {
                d = this._apply("dir_abs_declarator");
                return this._applyWithArgs("amember_decl", d);
            }, function() {
                d = this._apply("dir_abs_declarator");
                return this._applyWithArgs("acall_decl", d);
            });
        },
        amember_decl: function(p) {
            var $elf = this, _fromIdx = this.input.idx, e;
            return this._or(function() {
                this._applyWithArgs("token", "[");
                e = this._apply("const_expr");
                this._applyWithArgs("token", "]");
                return function() {
                    p.append(e);
                    p.type("member");
                    return p;
                }.call(this);
            }, function() {
                this._applyWithArgs("token", "[");
                this._apply("empty");
                this._applyWithArgs("token", "]");
                return function() {
                    p.type("member");
                    return p;
                }.call(this);
            });
        },
        acall_decl: function(p) {
            var $elf = this, _fromIdx = this.input.idx, l;
            return this._or(function() {
                this._applyWithArgs("token", "(");
                l = this._apply("param_type_lst");
                this._applyWithArgs("token", ")");
                return function() {
                    p.appendAll(l);
                    p.type("call");
                    return p;
                }.call(this);
            }, function() {
                this._applyWithArgs("token", "(");
                this._apply("empty");
                this._applyWithArgs("token", ")");
                return function() {
                    p.type("call");
                    return p;
                }.call(this);
            });
        },
        param_decl: function() {
            var $elf = this, _fromIdx = this.input.idx, al, dl, ds;
            return this._or(function() {
                ds = this._apply("decl_specs");
                dl = this._opt(function() {
                    return this._apply("declarator");
                });
                return __.ParamDeclaration(ds, dl);
            }, function() {
                ds = this._apply("decl_specs");
                al = this._apply("abs_declarator");
                return __.ParamDeclaration(ds, al);
            });
        },
        initializer: function() {
            var $elf = this, _fromIdx = this.input.idx, p;
            return this._or(function() {
                this._applyWithArgs("token", "{");
                p = this._applyWithArgs("listOf", "initializer_lst", ",");
                this._applyWithArgs("token", "}");
                return __.GroupInitializer(p);
            }, function() {
                return this._apply("assign_expr");
            });
        },
        initializer_lst: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._applyWithArgs("listOf", "initializer", ",");
        },
        stmt: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                return this._apply("labeled_stmt");
            }, function() {
                return this._apply("compound_stmt");
            }, function() {
                return this._apply("selection_stmt");
            }, function() {
                return this._apply("iteration_stmt");
            }, function() {
                return this._apply("jump_stmt");
            }, function() {
                return this._apply("expr_stmt");
            });
        },
        expr_stmt: function() {
            var $elf = this, _fromIdx = this.input.idx, e;
            e = this._opt(function() {
                return this._apply("expr");
            });
            this._applyWithArgs("token", ";");
            return __.ExprStmt(e);
        },
        labeled_stmt: function() {
            var $elf = this, _fromIdx = this.input.idx, e, l, s;
            return this._or(function() {
                l = this._applyWithArgs("token", "Id");
                this._applyWithArgs("token", ":");
                s = this._apply("stmt");
                return __.LabeledStmt(l.value(), s);
            }, function() {
                this._applyWithArgs("token", "case");
                e = this._apply("const_expr");
                this._applyWithArgs("token", ":");
                s = this._apply("stmt");
                return __.CaseStmt(e, s);
            }, function() {
                this._applyWithArgs("token", "default");
                this._applyWithArgs("token", ":");
                s = this._apply("stmt");
                return __.DefaultStmt(s);
            });
        },
        compound_stmt: function() {
            var $elf = this, _fromIdx = this.input.idx, d, s;
            this._applyWithArgs("token", "{");
            d = this._many(function() {
                return this._apply("declaration");
            });
            s = this._many(function() {
                return this._apply("stmt");
            });
            this._applyWithArgs("token", "}");
            return __.CompoundStmt(d, s);
        },
        selection_stmt: function() {
            var $elf = this, _fromIdx = this.input.idx, e, f, s;
            return this._or(function() {
                this._applyWithArgs("token", "if");
                this._applyWithArgs("token", "(");
                e = this._apply("expr");
                this._applyWithArgs("token", ")");
                s = this._apply("stmt");
                return this._or(function() {
                    this._applyWithArgs("token", "else");
                    f = this._apply("stmt");
                    return __.IfStmt(e, s, f);
                }, function() {
                    this._apply("empty");
                    return __.IfStmt(e, s);
                });
            }, function() {
                this._applyWithArgs("token", "switch");
                this._applyWithArgs("token", "(");
                e = this._apply("expr");
                this._applyWithArgs("token", ")");
                s = this._apply("stmt");
                return __.SwitchStmt(e, s);
            });
        },
        iteration_stmt: function() {
            var $elf = this, _fromIdx = this.input.idx, e, ee, ie, s, se;
            return this._or(function() {
                this._applyWithArgs("token", "while");
                this._applyWithArgs("token", "(");
                e = this._apply("expr");
                this._applyWithArgs("token", ")");
                s = this._apply("stmt");
                return __.WhileStmt(e, s);
            }, function() {
                this._applyWithArgs("token", "do");
                s = this._apply("stmt");
                this._applyWithArgs("token", "while");
                this._applyWithArgs("token", "(");
                e = this._apply("expr");
                this._applyWithArgs("token", ")");
                this._applyWithArgs("token", ";");
                return __.DoWhileStmt(e, s);
            }, function() {
                this._applyWithArgs("token", "for");
                this._applyWithArgs("token", "(");
                se = this._opt(function() {
                    return this._apply("expr");
                });
                this._applyWithArgs("token", ";");
                ee = this._opt(function() {
                    return this._apply("expr");
                });
                this._applyWithArgs("token", ";");
                ie = this._opt(function() {
                    return this._apply("expr");
                });
                this._applyWithArgs("token", ")");
                s = this._apply("stmt");
                return __.ForStmt(se, ee, ie, s);
            });
        },
        jump_stmt: function() {
            var $elf = this, _fromIdx = this.input.idx, e, l;
            return this._or(function() {
                this._applyWithArgs("token", "goto");
                l = this._applyWithArgs("token", "Id");
                this._applyWithArgs("token", ";");
                return __.GotoStmt(l.value());
            }, function() {
                this._applyWithArgs("token", "continue");
                this._applyWithArgs("token", ";");
                return __.ContinueStmt();
            }, function() {
                this._applyWithArgs("token", "break");
                this._applyWithArgs("token", ";");
                return __.BreakStmt();
            }, function() {
                this._applyWithArgs("token", "return");
                e = this._opt(function() {
                    return this._apply("expr");
                });
                this._applyWithArgs("token", ";");
                return __.ReturnStmt(e);
            });
        },
        external_decl: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                return this._apply("function_def");
            }, function() {
                return this._apply("declaration");
            });
        },
        function_def: function() {
            var $elf = this, _fromIdx = this.input.idx, dc, ds, s;
            ds = this._opt(function() {
                return this._apply("decl_specs");
            });
            dc = this._apply("declarator");
            s = this._apply("compound_stmt");
            return __.FuncDefinition(ds, dc, s);
        },
        translation_u: function() {
            var $elf = this, _fromIdx = this.input.idx, s;
            s = this._many1(function() {
                return this._apply("external_decl");
            });
            return __.Program(s);
        },
        topLevel: function() {
            var $elf = this, _fromIdx = this.input.idx, u;
            u = this._apply("translation_u");
            this._apply("spaces");
            this._apply("end");
            return u;
        }
    });
    CParser.position_info = function(input, from, to) {
        var position = function(pos) {
            for (var line = 1, column = void 0, i = pos; i >= 0; i--) if ("\n" === input[i]) {
                "undefined" == typeof column && (column = pos - i);
                line++;
            }
            1 === line && (column = pos);
            return {
                line: line,
                column: column
            };
        };
        return {
            source: input.slice(from, to),
            start: position(from),
            end: position(to)
        };
    };
    CParser.spec = {
        keywords: [ "auto", "break", "case", "char", "const", "continue", "default", "do", "double", "else", "enum", "extern", "float", "for", "goto", "if", "int", "long", "register", "return", "short", "signed", "sizeof", "static", "struct", "switch", "typedef", "union", "unsigned", "void", "volatile", "while" ],
        isKeyword: function(k) {
            return -1 != this.keywords.indexOf(k);
        }
    };
    CParser.parse = function(input) {
        return CParser.matchAll(input, "topLevel");
    };
    module.exports = CParser;
});