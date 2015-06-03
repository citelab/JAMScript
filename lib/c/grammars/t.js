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
                return this._apply("digit");
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
            return __.Special(s);
        },
        token: function(tt) {
            var $elf = this, _fromIdx = this.input.idx, t;
            this._apply("spaces");
            return this._or(function() {
                t = this._or(function() {
                    return this._apply("special");
                }, function() {
                    return this._apply("keyword");
                });
                this._pred(t.value == tt);
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
        expr: function() {
            var $elf = this, _fromIdx = this.input.idx, le;
            le = this._applyWithArgs("listOf", "assign_expr", ",");
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
                t = this._apply("expression");
                this._applyWithArgs("token", ":");
                f = this._apply("cond_expr");
                return __.CondExpr(e, t, f);
            }, function() {
                e = this._apply("lor_expr");
                return e;
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
                return __.BinaryExpr(x, y).operator("||");
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
            var $elf = this, _fromIdx = this.input.idx, x;
            return this._or(function() {
                x = this._apply("and_expr");
                this._applyWithArgs("token", "&");
                x = this._apply("eq_expr");
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
            var $elf = this, _fromIdx = this.input.idx, x, y;
            return this._or(function() {
                x = this._apply("add_expr");
                this._or(function() {
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
            var $elf = this, _fromIdx = this.input.idx, x, y;
            return this._or(function() {
                x = this._apply("mult_expr");
                this._or(function() {
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
            e = this._apply("left_expr");
            this._apply("spacesNoNl");
            op = this._or(function() {
                return this._applyWithArgs("token", "++");
            }, function() {
                return this._applyWithArgs("token", "--");
            });
            return __.UpdateExpr(e).operator(op.value()).prefix(!1);
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
                e = this._apply("expression");
                this._applyWithArgs("token", "]");
                return __.MemberExpr(p, e);
            }, function() {
                this._applyWithArgs("token", ".");
                i = this._applyWithArgs("token", "id");
                return __.MemberExpr(p).name(i.value());
            }, function() {
                this._applyWithArgs("token", "->");
                i = this._applyWithArgs("token", "id");
                return __.PointerExpr(p).name(i.value());
            });
        },
        primary_expr: function() {
            var $elf = this, _fromIdx = this.input.idx, e;
            return this._or(function() {
                return this._applyWithArgs("token", "id");
            }, function() {
                return this._applyWithArgs("token", "const");
            }, function() {
                return this._applyWithArgs("token", "string");
            }, function() {
                this._applyWithArgs("token", "(");
                e = this._apply("expression");
                this._applyWithArgs("token", ")");
                return __.GroupExpr(e);
            });
        },
        const_expr: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._apply("cond_expr");
        },
        declaration: function() {
            var $elf = this, _fromIdx = this.input.idx, ds, id;
            ds = this._apply("decl_specs");
            id = this._many(function() {
                return this._apply("init_decl");
            });
            this._applyWithArgs("token", ";");
            return __.MakeDeclaration(ds, idec);
        },
        decl_specs: function() {
            var $elf = this, _fromIdx = this.input.idx, ds, s, t;
            return this._or(function() {
                s = this._apply("store_cl_spec");
                ds = this._many(function() {
                    return this._apply("decl_specs");
                });
                return ds.concat(s);
            }, function() {
                t = this._apply("type_spec");
                ds = this._many(function() {
                    return this._apply("decl_specs");
                });
                return ds.concat(t);
            }, function() {
                t = this._apply("type_qualifier");
                ds = this._many(function() {
                    return this._apply("decl_specs");
                });
                return ds.concat(t);
            });
        },
        init_decl: function() {
            var $elf = this, _fromIdx = this.input.idx, d, i;
            return this._or(function() {
                d = this._apply("declarator");
                this._applyWithArgs("token", "=");
                i = this._apply("initializer");
                return __.InitDeclarator(d, i);
            }, function() {
                d = this._apply("declarator");
                return __.InitDeclarator(d);
            });
        },
        store_cl_spec: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
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
            var $elf = this, _fromIdx = this.input.idx, d, p;
            return this._or(function() {
                p = this._apply("pointer");
                d = this._apply("dir_declarator");
                return __.PointerDeclarator(d, p);
            }, function() {
                return this._apply("dir_declarator");
            });
        },
        dir_declarator: function() {
            var $elf = this, _fromIdx = this.input.idx, d;
            return this._or(function() {
                d = this._apply("dir_declarator");
                return this._applyWithArgs("pmember_decl", d);
            }, function() {
                d = this._apply("dir_declarator");
                return this._applyWithArgs("pcall_decl", d);
            }, function() {
                this._applyWithArgs("token", "(");
                this._apply("declarator");
                return this._applyWithArgs("token", ")");
            }, function() {
                return this._applyWithArgs("token", "id");
            });
        },
        pmember_decl: function(p) {
            var $elf = this, _fromIdx = this.input.idx;
            return this._or(function() {
                this._applyWithArgs("token", "[ const_expr:e ]");
                return __.MemberDecl(p, e);
            }, function() {
                this._applyWithArgs("token", "[");
                this._applyWithArgs("token", "]");
                return __.MemberDecl(p);
            });
        },
        pcall_decl: function(p) {
            var $elf = this, _fromIdx = this.input.idx, g;
            this._applyWithArgs("token", "(");
            g = this._or(function() {
                return this._apply("param_type_lst");
            }, function() {
                return this._apply("ident_list");
            }, function() {
                return this._apply("empty");
            });
            this._applyWithArgs("token", ")");
            return __.GroupDecl(p, g);
        },
        pointer: function() {
            var $elf = this, _fromIdx = this.input.idx, pn, pt;
            pn = this._many1(function() {
                return this._applyWithArgs("token", "*");
            });
            pt = this._or(function() {
                return this._applyWithArgs("token", "const");
            }, function() {
                return this._applyWithArgs("token", "volatile");
            });
            return __.PointerType(pt, pn);
        },
        param_type_lst: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._applyWithArgs("listOf", "param_decl", ",");
        },
        param_decl: function() {
            var $elf = this, _fromIdx = this.input.idx, dl, ds;
            ds = this._apply("decl_specs");
            dl = this._opt(function() {
                return this._apply("declarator");
            });
            return __.ParamDeclaration(dl, ds);
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
                l = this._applyWithArgs("token", "id");
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
                l = this._applyWithArgs("token", "id");
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
            return __.FuncDeclare(ds, dc, s);
        },
        translation_u: function() {
            var $elf = this, _fromIdx = this.input.idx;
            return this._many1(function() {
                return this._apply("external_decl");
            });
        },
        topLevel: function() {
            var $elf = this, _fromIdx = this.input.idx;
            this._many1(function() {
                return this._apply("expr");
            });
            this._apply("spaces");
            return this._apply("end");
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