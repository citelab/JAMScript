/**
 * Bootstrapper
 * ------------
 * Compiler manually adapted to work with newest base.js
 */
var OMeta = require('../base.js');

//////////////////////////////// COMPILE TIME ///////////////////////////////////////////
// TODO maybe this could be externalized in separate module or could be compiled on the fly
// and imported
//
var ometa_compiler = (function () {

    // String escape funtionality
    // Required by BSOMetaParser and BSJSParser
    function unescape(s) {
        if (s.charAt(0) == "\\") {
            switch (s.charAt(1)) {
            case "'":
                return "'";
            case '"':
                return '"';
            case "\\":
                return "\\";
            case "b":
                return "\u0008";
            case "f":
                return "\u000c";
            case "n":
                return "\n";
            case "r":
                return "\r";
            case "t":
                return "\t";
            case "v":
                return "\u000b";
            case "x":
                return String.fromCharCode(parseInt(s.substring(2, 4), 16));
            case "u":
                return String.fromCharCode(parseInt(s.substring(2, 6), 16));
            default:
                return s.charAt(1)
            }
        } else {
            return s
        }
    }

    function pad(string, char, len) {
        if (string.length >= len) return string;

        var to_pad = [];
        to_pad.length = len - string.length;
        to_pad.push(string);
        to_pad.join(char);
        return to_pad;
    }

    var escapeChar = (function () {

        // escape table    
        var table = {};
        for (var char = 0; char < 128; char++) {
            table[char] = String.fromCharCode(char)
        }
        table["'".charCodeAt(0)] = "\\'";
        table['"'.charCodeAt(0)] = '\\"';
        table["\\".charCodeAt(0)] = "\\\\";
        table["\u0008".charCodeAt(0)] = "\\b";
        table["\u000c".charCodeAt(0)] = "\\f";
        table["\n".charCodeAt(0)] = "\\n";
        table["\r".charCodeAt(0)] = "\\r";
        table["\t".charCodeAt(0)] = "\\t";
        table["\u000b".charCodeAt(0)] = "\\v";

        return function (char) {

            var charCode = char.charCodeAt(0);
            return charCode > 255 ? String.fromCharCode(charCode) : table[charCode];
            if (charCode < 128) {
                return table[charCode]
            } else {
                if (128 <= charCode && charCode < 256) {
                    return "\\x" + pad(charCode.toString(16), "0", 2)
                } else {
                    return "\\u" + pad(charCode.toString(16), "0", 4)
                }
            }
        }
    })();

    function StringBuffer() {
        this.strings = [];
        for (var i = 0, len = arguments.length; i < len; i++) {
            this.nextPutAll(arguments[i])
        }
    }
    StringBuffer.prototype = {
        nextPutAll: function (s) {
            this.strings.push(s)
        },
        contents: function () {
            return this.strings.join("")
        }
    };

    function writeStream(el) {
        return new StringBuffer(el);
    }


    // TODO i have to try to avoid this
    // toProgramString can be removed after rewriting it as a function in the grammar of
    // - BSJSTranslator
    // - BSOMetaTranslator
    Object.extend(String.prototype, {

        toProgramString: function () {
            var ws = writeStream('"');
            for (var i = 0, len = this.length; i < len; i++) {
                ws.nextPutAll(escapeChar(this.charAt(i)))
            }
            ws.nextPutAll('"');
            return ws.contents()
        }

    });

    // Where is this needed for? Maybe output of AST?
/*
  function printOn(x, ws) {
    if(x === undefined || x === null) {
      ws.nextPutAll("" + x)
    } else {
      if(x.constructor === Array) {
        ws.nextPutAll("[");
        for(var idx = 0;idx < x.length;idx++) {
          if(idx > 0) {
            ws.nextPutAll(", ")
          }
          printOn(x[idx], ws)
        }
        ws.nextPutAll("]")
      }else {
        ws.nextPutAll(x.toString())
      }
    }
  }

  Object.extend(Array.prototype, {

    toString: function() {
      var ws = writeStream("");
      printOn(this, ws);
      return ws.contents()
    }

  }); */

    /**
     * 3. GENERATED Parser, Translator and Optimizer code
     * ---------------------------------------------------
     */
    var BSJSParser = Object.inherit(OMeta, {
        "space": function () {
            return this._or(function () {
                return OMeta._superApplyWithArgs(this, "space")
            }, function () {
                return this._applyWithArgs("fromTo", "//", "\n")
            }, function () {
                return this._applyWithArgs("fromTo", "/*", "*/")
            })
        },
        "nameFirst": function () {
            return this._or(function () {
                return this._apply("letter")
            }, function () {
                return function () {
                    switch (this._apply("anything")) {
                    case "$":
                        return "$";
                    case "_":
                        return "_";
                    default:
                        this.bt.mismatch("Fail")
                    }
                }.call(this)
            })
        },
        "nameRest": function () {
            return this._or(function () {
                return this._apply("nameFirst")
            }, function () {
                return this._apply("digit")
            })
        },
        "iName": function () {
            return this._consumedBy(function () {
                return function () {
                    this._apply("nameFirst");
                    return this._many(function () {
                        return this._apply("nameRest")
                    })
                }.call(this)
            })
        },
        "isKeyword": function () {
            var x;
            return function () {
                x = this._apply("anything");
                return this._pred(BSJSParser._isKeyword(x))
            }.call(this)
        },
        "name": function () {
            var n;
            return function () {
                n = this._apply("iName");
                this._not(function () {
                    return this._applyWithArgs("isKeyword", n)
                });
                return ["name", n]
            }.call(this)
        },
        "keyword": function () {
            var k;
            return function () {
                k = this._apply("iName");
                this._applyWithArgs("isKeyword", k);
                return [k, k]
            }.call(this)
        },
        "hexDigit": function () {
            var x, v;
            return function () {
                x = this._apply("char");
                v = this["hexDigits"].indexOf(x.toLowerCase());
                this._pred(v >= 0);
                return v
            }.call(this)
        },
        "hexLit": function () {
            var n, d;
            return this._or(function () {
                return function () {
                    n = this._apply("hexLit");
                    d = this._apply("hexDigit");
                    return n * 16 + d
                }.call(this)
            }, function () {
                return this._apply("hexDigit")
            })
        },
        "number": function () {
            var n, f;
            return this._or(function () {
                return function () {
                    switch (this._apply("anything")) {
                    case "0":
                        return function () {
                            this._applyWithArgs("exactly", "x");
                            "0x";
                            n = this._apply("hexLit");
                            return ["number", n]
                        }.call(this);
                    default:
                        this.bt.mismatch("Fail")
                    }
                }.call(this)
            }, function () {
                return function () {
                    f = this._consumedBy(function () {
                        return function () {
                            this._many1(function () {
                                return this._apply("digit")
                            });
                            return this._opt(function () {
                                return function () {
                                    this._applyWithArgs("exactly", ".");
                                    return this._many1(function () {
                                        return this._apply("digit")
                                    })
                                }.call(this)
                            })
                        }.call(this)
                    });
                    return ["number", parseFloat(f)]
                }.call(this)
            })
        },
        "escapeChar": function () {
            var c;
            return function () {
                this._applyWithArgs("exactly", "\\");
                c = this._apply("char");
                return unescape("\\" + c)
            }.call(this)
        },
        "str": function () {
            var cs, cs, cs, n;
            return this._or(function () {
                return function () {
                    switch (this._apply("anything")) {
                    case '"':
                        return this._or(function () {
                            return function () {
                                switch (this._apply("anything")) {
                                case '"':
                                    return function () {
                                        this._applyWithArgs("exactly", '"');
                                        '"""';
                                        cs = this._many(function () {
                                            return this._or(function () {
                                                return this._apply("escapeChar")
                                            }, function () {
                                                return function () {
                                                    this._not(function () {
                                                        return function () {
                                                            this._applyWithArgs("exactly", '"');
                                                            this._applyWithArgs("exactly", '"');
                                                            this._applyWithArgs("exactly", '"');
                                                            return '"""'
                                                        }.call(this)
                                                    });
                                                    return this._apply("char")
                                                }.call(this)
                                            })
                                        });
                                        this._applyWithArgs("exactly", '"');
                                        this._applyWithArgs("exactly", '"');
                                        this._applyWithArgs("exactly", '"');
                                        '"""';
                                        return ["string", cs.join("")]
                                    }.call(this);
                                default:
                                    this.bt.mismatch("Fail")
                                }
                            }.call(this)
                        }, function () {
                            return function () {
                                cs = this._many(function () {
                                    return this._or(function () {
                                        return this._apply("escapeChar")
                                    }, function () {
                                        return function () {
                                            this._not(function () {
                                                return this._applyWithArgs("exactly", '"')
                                            });
                                            return this._apply("char")
                                        }.call(this)
                                    })
                                });
                                this._applyWithArgs("exactly", '"');
                                return ["string", cs.join("")]
                            }.call(this)
                        });
                    case "'":
                        return function () {
                            cs = this._many(function () {
                                return this._or(function () {
                                    return this._apply("escapeChar")
                                }, function () {
                                    return function () {
                                        this._not(function () {
                                            return this._applyWithArgs("exactly", "'")
                                        });
                                        return this._apply("char")
                                    }.call(this)
                                })
                            });
                            this._applyWithArgs("exactly", "'");
                            return ["string", cs.join("")]
                        }.call(this);
                    default:
                        this.bt.mismatch("Fail")
                    }
                }.call(this)
            }, function () {
                return function () {
                    (function () {
                        switch (this._apply("anything")) {
                        case "#":
                            return "#";
                        case "`":
                            return "`";
                        default:
                            this.bt.mismatch("Fail")
                        }
                    }).call(this);
                    n = this._apply("iName");
                    return ["string", n]
                }.call(this)
            })
        },
        "special": function () {
            var s;
            return function () {
                s = function () {
                    switch (this._apply("anything")) {
                    case "(":
                        return "(";
                    case ")":
                        return ")";
                    case "{":
                        return "{";
                    case "}":
                        return "}";
                    case "[":
                        return "[";
                    case "]":
                        return "]";
                    case ",":
                        return ",";
                    case ";":
                        return ";";
                    case "?":
                        return "?";
                    case ":":
                        return ":";
                    case "!":
                        return this._or(function () {
                            return function () {
                                switch (this._apply("anything")) {
                                case "=":
                                    return this._or(function () {
                                        return function () {
                                            switch (this._apply("anything")) {
                                            case "=":
                                                return "!==";
                                            default:
                                                this.bt.mismatch("Fail")
                                            }
                                        }.call(this)
                                    }, function () {
                                        return "!="
                                    });
                                default:
                                    this.bt.mismatch("Fail");
                                }
                            }.call(this)
                        }, function () {
                            return "!"
                        });
                    case "=":
                        return this._or(function () {
                            return function () {
                                switch (this._apply("anything")) {
                                case "=":
                                    return this._or(function () {
                                        return function () {
                                            switch (this._apply("anything")) {
                                            case "=":
                                                return "===";
                                            default:
                                                this.bt.mismatch("Fail");
                                            }
                                        }.call(this)
                                    }, function () {
                                        return "=="
                                    });
                                default:
                                    this.bt.mismatch("Fail");
                                }
                            }.call(this)
                        }, function () {
                            return "="
                        });
                    case ">":
                        return this._or(function () {
                            return function () {
                                switch (this._apply("anything")) {
                                case "=":
                                    return ">=";
                                default:
                                    this.bt.mismatch("Fail");
                                }
                            }.call(this)
                        }, function () {
                            return ">"
                        });
                    case "<":
                        return this._or(function () {
                            return function () {
                                switch (this._apply("anything")) {
                                case "=":
                                    return "<=";
                                default:
                                    this.bt.mismatch("Fail");
                                }
                            }.call(this)
                        }, function () {
                            return "<"
                        });
                    case "+":
                        return this._or(function () {
                            return function () {
                                switch (this._apply("anything")) {
                                case "+":
                                    return "++";
                                case "=":
                                    return "+=";
                                default:
                                    this.bt.mismatch("Fail");
                                }
                            }.call(this)
                        }, function () {
                            return "+"
                        });
                    case "-":
                        return this._or(function () {
                            return function () {
                                switch (this._apply("anything")) {
                                case "-":
                                    return "--";
                                case "=":
                                    return "-=";
                                default:
                                    this.bt.mismatch("Fail");
                                }
                            }.call(this)
                        }, function () {
                            return "-"
                        });
                    case "*":
                        return this._or(function () {
                            return function () {
                                switch (this._apply("anything")) {
                                case "=":
                                    return "*=";
                                default:
                                    this.bt.mismatch("Fail");
                                }
                            }.call(this)
                        }, function () {
                            return "*"
                        });
                    case "/":
                        return this._or(function () {
                            return function () {
                                switch (this._apply("anything")) {
                                case "=":
                                    return "/=";
                                default:
                                    this.bt.mismatch("Fail");
                                }
                            }.call(this)
                        }, function () {
                            return "/"
                        });
                    case "%":
                        return this._or(function () {
                            return function () {
                                switch (this._apply("anything")) {
                                case "=":
                                    return "%=";
                                default:
                                    this.bt.mismatch("Fail");
                                }
                            }.call(this)
                        }, function () {
                            return "%"
                        });
                    case "&":
                        return function () {
                            switch (this._apply("anything")) {
                            case "&":
                                return this._or(function () {
                                    return function () {
                                        switch (this._apply("anything")) {
                                        case "=":
                                            return "&&=";
                                        default:
                                            this.bt.mismatch("Fail");
                                        }
                                    }.call(this)
                                }, function () {
                                    return "&&"
                                });
                            default:
                                this.bt.mismatch("Fail");
                            }
                        }.call(this);
                    case "|":
                        return function () {
                            switch (this._apply("anything")) {
                            case "|":
                                return this._or(function () {
                                    return function () {
                                        switch (this._apply("anything")) {
                                        case "=":
                                            return "||=";
                                        default:
                                            this.bt.mismatch("Fail");
                                        }
                                    }.call(this)
                                }, function () {
                                    return "||"
                                });
                            default:
                                this.bt.mismatch("Fail");
                            }
                        }.call(this);
                    case ".":
                        return ".";
                    default:
                        this.bt.mismatch("Fail");
                    }
                }.call(this);
                return [s, s]
            }.call(this)
        },
        "tok": function () {
            return function () {
                this._apply("spaces");
                return this._or(function () {
                    return this._apply("name")
                }, function () {
                    return this._apply("keyword")
                }, function () {
                    return this._apply("number")
                }, function () {
                    return this._apply("str")
                }, function () {
                    return this._apply("special")
                })
            }.call(this)
        },
        "toks": function () {
            var ts;
            return function () {
                ts = this._many(function () {
                    return this._apply("token")
                });
                this._apply("spaces");
                this._apply("end");
                return ts
            }.call(this)
        },
        "token": function () {
            var tt, t;
            return function () {
                tt = this._apply("anything");
                t = this._apply("tok");
                this._pred(t[0] == tt);
                return t[1]
            }.call(this)
        },
        "spacesNoNl": function () {
            return this._many(function () {
                return function () {
                    this._not(function () {
                        return this._applyWithArgs("exactly", "\n")
                    });
                    return this._apply("space")
                }.call(this)
            })
        },
        "expr": function () {
            var e, t, f, rhs, rhs, rhs, rhs, rhs, rhs, rhs, rhs;
            return function () {
                e = this._apply("orExpr");
                return this._or(function () {
                    return function () {
                        this._applyWithArgs("token", "?");
                        t = this._apply("expr");
                        this._applyWithArgs("token", ":");
                        f = this._apply("expr");
                        return ["condExpr", e, t, f]
                    }.call(this)
                }, function () {
                    return function () {
                        this._applyWithArgs("token", "=");
                        rhs = this._apply("expr");
                        return ["set", e, rhs]
                    }.call(this)
                }, function () {
                    return function () {
                        this._applyWithArgs("token", "+=");
                        rhs = this._apply("expr");
                        return ["mset", e, "+", rhs]
                    }.call(this)
                }, function () {
                    return function () {
                        this._applyWithArgs("token", "-=");
                        rhs = this._apply("expr");
                        return ["mset", e, "-", rhs]
                    }.call(this)
                }, function () {
                    return function () {
                        this._applyWithArgs("token", "*=");
                        rhs = this._apply("expr");
                        return ["mset", e, "*", rhs]
                    }.call(this)
                }, function () {
                    return function () {
                        this._applyWithArgs("token", "/=");
                        rhs = this._apply("expr");
                        return ["mset", e, "/", rhs]
                    }.call(this)
                }, function () {
                    return function () {
                        this._applyWithArgs("token", "%=");
                        rhs = this._apply("expr");
                        return ["mset", e, "%", rhs]
                    }.call(this)
                }, function () {
                    return function () {
                        this._applyWithArgs("token", "&&=");
                        rhs = this._apply("expr");
                        return ["mset", e, "&&", rhs]
                    }.call(this)
                }, function () {
                    return function () {
                        this._applyWithArgs("token", "||=");
                        rhs = this._apply("expr");
                        return ["mset", e, "||", rhs]
                    }.call(this)
                }, function () {
                    return function () {
                        this._apply("empty");
                        return e
                    }.call(this)
                })
            }.call(this)
        },
        "orExpr": function () {
            var x, y;
            return this._or(function () {
                return function () {
                    x = this._apply("orExpr");
                    this._applyWithArgs("token", "||");
                    y = this._apply("andExpr");
                    return ["binop", "||", x, y]
                }.call(this)
            }, function () {
                return this._apply("andExpr")
            })
        },
        "andExpr": function () {
            var x, y;
            return this._or(function () {
                return function () {
                    x = this._apply("andExpr");
                    this._applyWithArgs("token", "&&");
                    y = this._apply("eqExpr");
                    return ["binop", "&&", x, y]
                }.call(this)
            }, function () {
                return this._apply("eqExpr")
            })
        },
        "eqExpr": function () {
            var x, y, y, y, y;
            return this._or(function () {
                return function () {
                    x = this._apply("eqExpr");
                    return this._or(function () {
                        return function () {
                            this._applyWithArgs("token", "==");
                            y = this._apply("relExpr");
                            return ["binop", "==", x, y]
                        }.call(this)
                    }, function () {
                        return function () {
                            this._applyWithArgs("token", "!=");
                            y = this._apply("relExpr");
                            return ["binop", "!=", x, y]
                        }.call(this)
                    }, function () {
                        return function () {
                            this._applyWithArgs("token", "===");
                            y = this._apply("relExpr");
                            return ["binop", "===", x, y]
                        }.call(this)
                    }, function () {
                        return function () {
                            this._applyWithArgs("token", "!==");
                            y = this._apply("relExpr");
                            return ["binop", "!==", x, y]
                        }.call(this)
                    })
                }.call(this)
            }, function () {
                return this._apply("relExpr")
            })
        },
        "relExpr": function () {
            var x, y, y, y, y, y;
            return this._or(function () {
                return function () {
                    x = this._apply("relExpr");
                    return this._or(function () {
                        return function () {
                            this._applyWithArgs("token", ">");
                            y = this._apply("addExpr");
                            return ["binop", ">", x, y]
                        }.call(this)
                    }, function () {
                        return function () {
                            this._applyWithArgs("token", ">=");
                            y = this._apply("addExpr");
                            return ["binop", ">=", x, y]
                        }.call(this)
                    }, function () {
                        return function () {
                            this._applyWithArgs("token", "<");
                            y = this._apply("addExpr");
                            return ["binop", "<", x, y]
                        }.call(this)
                    }, function () {
                        return function () {
                            this._applyWithArgs("token", "<=");
                            y = this._apply("addExpr");
                            return ["binop", "<=", x, y]
                        }.call(this)
                    }, function () {
                        return function () {
                            this._applyWithArgs("token", "instanceof");
                            y = this._apply("addExpr");
                            return ["binop", "instanceof", x, y]
                        }.call(this)
                    })
                }.call(this)
            }, function () {
                return this._apply("addExpr")
            })
        },
        "addExpr": function () {
            var x, y, x, y;
            return this._or(function () {
                return function () {
                    x = this._apply("addExpr");
                    this._applyWithArgs("token", "+");
                    y = this._apply("mulExpr");
                    return ["binop", "+", x, y]
                }.call(this)
            }, function () {
                return function () {
                    x = this._apply("addExpr");
                    this._applyWithArgs("token", "-");
                    y = this._apply("mulExpr");
                    return ["binop", "-", x, y]
                }.call(this)
            }, function () {
                return this._apply("mulExpr")
            })
        },
        "mulExpr": function () {
            var x, y, x, y, x, y;
            return this._or(function () {
                return function () {
                    x = this._apply("mulExpr");
                    this._applyWithArgs("token", "*");
                    y = this._apply("unary");
                    return ["binop", "*", x, y]
                }.call(this)
            }, function () {
                return function () {
                    x = this._apply("mulExpr");
                    this._applyWithArgs("token", "/");
                    y = this._apply("unary");
                    return ["binop", "/", x, y]
                }.call(this)
            }, function () {
                return function () {
                    x = this._apply("mulExpr");
                    this._applyWithArgs("token", "%");
                    y = this._apply("unary");
                    return ["binop", "%", x, y]
                }.call(this)
            }, function () {
                return this._apply("unary")
            })
        },
        "unary": function () {
            var p, p, p, p, p, p, p, p;
            return this._or(function () {
                return function () {
                    this._applyWithArgs("token", "-");
                    p = this._apply("postfix");
                    return ["unop", "-", p]
                }.call(this)
            }, function () {
                return function () {
                    this._applyWithArgs("token", "+");
                    p = this._apply("postfix");
                    return ["unop", "+", p]
                }.call(this)
            }, function () {
                return function () {
                    this._applyWithArgs("token", "++");
                    p = this._apply("postfix");
                    return ["preop", "++", p]
                }.call(this)
            }, function () {
                return function () {
                    this._applyWithArgs("token", "--");
                    p = this._apply("postfix");
                    return ["preop", "--", p]
                }.call(this)
            }, function () {
                return function () {
                    this._applyWithArgs("token", "!");
                    p = this._apply("unary");
                    return ["unop", "!", p]
                }.call(this)
            }, function () {
                return function () {
                    this._applyWithArgs("token", "void");
                    p = this._apply("unary");
                    return ["unop", "void", p]
                }.call(this)
            }, function () {
                return function () {
                    this._applyWithArgs("token", "delete");
                    p = this._apply("unary");
                    return ["unop", "delete", p]
                }.call(this)
            }, function () {
                return function () {
                    this._applyWithArgs("token", "typeof");
                    p = this._apply("unary");
                    return ["unop", "typeof", p]
                }.call(this)
            }, function () {
                return this._apply("postfix")
            })
        },
        "postfix": function () {
            var p;
            return function () {
                p = this._apply("primExpr");
                return this._or(function () {
                    return function () {
                        this._apply("spacesNoNl");
                        this._applyWithArgs("token", "++");
                        return ["postop", "++", p]
                    }.call(this)
                }, function () {
                    return function () {
                        this._apply("spacesNoNl");
                        this._applyWithArgs("token", "--");
                        return ["postop", "--", p]
                    }.call(this)
                }, function () {
                    return function () {
                        this._apply("empty");
                        return p
                    }.call(this)
                })
            }.call(this)
        },
        "primExpr": function () {
            var p, i, m, as, f, as;
            return this._or(function () {
                return function () {
                    p = this._apply("primExpr");
                    return this._or(function () {
                        return function () {
                            this._applyWithArgs("token", "[");
                            i = this._apply("expr");
                            this._applyWithArgs("token", "]");
                            return ["getp", i, p]
                        }.call(this)
                    }, function () {
                        return function () {
                            this._applyWithArgs("token", ".");
                            m = this._applyWithArgs("token", "name");
                            this._applyWithArgs("token", "(");
                            as = this._applyWithArgs("listOf", "expr", ",");
                            this._applyWithArgs("token", ")");
                            return ["send", m, p].concat(as)
                        }.call(this)
                    }, function () {
                        return function () {
                            this._applyWithArgs("token", ".");
                            f = this._applyWithArgs("token", "name");
                            return ["getp", ["string", f], p]
                        }.call(this)
                    }, function () {
                        return function () {
                            this._applyWithArgs("token", "(");
                            as = this._applyWithArgs("listOf", "expr", ",");
                            this._applyWithArgs("token", ")");
                            return ["call", p].concat(as)
                        }.call(this)
                    })
                }.call(this)
            }, function () {
                return this._apply("primExprHd")
            })
        },
        "primExprHd": function () {
            var e, n, n, s, n, as, es;
            return this._or(function () {
                return function () {
                    this._applyWithArgs("token", "(");
                    e = this._apply("expr");
                    this._applyWithArgs("token", ")");
                    return e
                }.call(this)
            }, function () {
                return function () {
                    this._applyWithArgs("token", "this");
                    return ["this"]
                }.call(this)
            }, function () {
                return function () {
                    n = this._applyWithArgs("token", "name");
                    return ["get", n]
                }.call(this)
            }, function () {
                return function () {
                    n = this._applyWithArgs("token", "number");
                    return ["number", n]
                }.call(this)
            }, function () {
                return function () {
                    s = this._applyWithArgs("token", "string");
                    return ["string", s]
                }.call(this)
            }, function () {
                return function () {
                    this._applyWithArgs("token", "function");
                    return this._apply("funcRest")
                }.call(this)
            }, function () {
                return function () {
                    this._applyWithArgs("token", "new");
                    n = this._applyWithArgs("token", "name");
                    this._applyWithArgs("token", "(");
                    as = this._applyWithArgs("listOf", "expr", ",");
                    this._applyWithArgs("token", ")");
                    return ["new", n].concat(as)
                }.call(this)
            }, function () {
                return function () {
                    this._applyWithArgs("token", "[");
                    es = this._applyWithArgs("listOf", "expr", ",");
                    this._applyWithArgs("token", "]");
                    return ["arr"].concat(es)
                }.call(this)
            }, function () {
                return this._apply("json")
            }, function () {
                return this._apply("re")
            })
        },
        "json": function () {
            var bs;
            return function () {
                this._applyWithArgs("token", "{");
                bs = this._applyWithArgs("listOf", "jsonBinding", ",");
                this._applyWithArgs("token", "}");
                return ["json"].concat(bs)
            }.call(this)
        },
        "jsonBinding": function () {
            var n, v;
            return function () {
                n = this._apply("jsonPropName");
                this._applyWithArgs("token", ":");
                v = this._apply("expr");
                return ["binding", n, v]
            }.call(this)
        },
        "jsonPropName": function () {
            return this._or(function () {
                return this._applyWithArgs("token", "name")
            }, function () {
                return this._applyWithArgs("token", "number")
            }, function () {
                return this._applyWithArgs("token", "string")
            })
        },
        "re": function () {
            var x;
            return function () {
                this._apply("spaces");
                x = this._consumedBy(function () {
                    return function () {
                        this._applyWithArgs("exactly", "/");
                        this._apply("reBody");
                        this._applyWithArgs("exactly", "/");
                        return this._many(function () {
                            return this._apply("reFlag")
                        })
                    }.call(this)
                });
                return ["regExpr", x]
            }.call(this)
        },
        "reBody": function () {
            return function () {
                this._apply("re1stChar");
                return this._many(function () {
                    return this._apply("reChar")
                })
            }.call(this)
        },
        "re1stChar": function () {
            return this._or(function () {
                return function () {
                    this._not(function () {
                        return function () {
                            switch (this._apply("anything")) {
                            case "*":
                                return "*";
                            case "\\":
                                return "\\";
                            case "/":
                                return "/";
                            case "[":
                                return "[";
                            default:
                                this.bt.mismatch("Fail");
                            }
                        }.call(this)
                    });
                    return this._apply("reNonTerm")
                }.call(this)
            }, function () {
                return this._apply("escapeChar")
            }, function () {
                return this._apply("reClass")
            })
        },
        "reChar": function () {
            return this._or(function () {
                return this._apply("re1stChar")
            }, function () {
                return function () {
                    switch (this._apply("anything")) {
                    case "*":
                        return "*";
                    default:
                        this.bt.mismatch("Fail");
                    }
                }.call(this)
            })
        },
        "reNonTerm": function () {
            return function () {
                this._not(function () {
                    return function () {
                        switch (this._apply("anything")) {
                        case "\n":
                            return "\n";
                        case "\r":
                            return "\r";
                        default:
                            this.bt.mismatch("Fail");
                        }
                    }.call(this)
                });
                return this._apply("char")
            }.call(this)
        },
        "reClass": function () {
            return function () {
                this._applyWithArgs("exactly", "[");
                this._many(function () {
                    return this._apply("reClassChar")
                });
                return this._applyWithArgs("exactly", "]")
            }.call(this)
        },
        "reClassChar": function () {
            return function () {
                this._not(function () {
                    return function () {
                        switch (this._apply("anything")) {
                        case "[":
                            return "[";
                        case "]":
                            return "]";
                        default:
                            this.bt.mismatch("Fail");
                        }
                    }.call(this)
                });
                return this._apply("reChar")
            }.call(this)
        },
        "reFlag": function () {
            return this._apply("nameFirst")
        },
        "formal": function () {
            return function () {
                this._apply("spaces");
                return this._applyWithArgs("token", "name")
            }.call(this)
        },
        "funcRest": function () {
            var fs, body;
            return function () {
                this._applyWithArgs("token", "(");
                fs = this._applyWithArgs("listOf", "formal", ",");
                this._applyWithArgs("token", ")");
                this._applyWithArgs("token", "{");
                body = this._apply("srcElems");
                this._applyWithArgs("token", "}");
                return ["func", fs, body]
            }.call(this)
        },
        "sc": function () {
            return this._or(function () {
                return function () {
                    this._apply("spacesNoNl");
                    return this._or(function () {
                        return function () {
                            switch (this._apply("anything")) {
                            case "\n":
                                return "\n";
                            default:
                                this.bt.mismatch("Fail");
                            }
                        }.call(this)
                    }, function () {
                        return this._lookahead(function () {
                            return this._applyWithArgs("exactly", "}")
                        })
                    }, function () {
                        return this._apply("end")
                    })
                }.call(this)
            }, function () {
                return this._applyWithArgs("token", ";")
            })
        },
        "binding": function () {
            var n, v;
            return function () {
                n = this._applyWithArgs("token", "name");
                v = this._or(function () {
                    return function () {
                        this._applyWithArgs("token", "=");
                        return this._apply("expr")
                    }.call(this)
                }, function () {
                    return function () {
                        this._apply("empty");
                        return ["get", "undefined"]
                    }.call(this)
                });
                return ["var", n, v]
            }.call(this)
        },
        "block": function () {
            var ss;
            return function () {
                this._applyWithArgs("token", "{");
                ss = this._apply("srcElems");
                this._applyWithArgs("token", "}");
                return ss
            }.call(this)
        },
        "stmt": function () {
            var bs, c, t, f, c, s, s, c, i, c, u, s, n, v, e, s, e, c, cs, cs, cs, e, t, e, c, f, e, x, s, e;
            return this._or(function () {
                return this._apply("block")
            }, function () {
                return function () {
                    this._applyWithArgs("token", "var");
                    bs = this._applyWithArgs("listOf", "binding", ",");
                    this._apply("sc");
                    return ["begin"].concat(bs)
                }.call(this)
            }, function () {
                return function () {
                    this._applyWithArgs("token", "if");
                    this._applyWithArgs("token", "(");
                    c = this._apply("expr");
                    this._applyWithArgs("token", ")");
                    t = this._apply("stmt");
                    f = this._or(function () {
                        return function () {
                            this._applyWithArgs("token", "else");
                            return this._apply("stmt")
                        }.call(this)
                    }, function () {
                        return function () {
                            this._apply("empty");
                            return ["get", "undefined"]
                        }.call(this)
                    });
                    return ["if", c, t, f]
                }.call(this)
            }, function () {
                return function () {
                    this._applyWithArgs("token", "while");
                    this._applyWithArgs("token", "(");
                    c = this._apply("expr");
                    this._applyWithArgs("token", ")");
                    s = this._apply("stmt");
                    return ["while", c, s]
                }.call(this)
            }, function () {
                return function () {
                    this._applyWithArgs("token", "do");
                    s = this._apply("stmt");
                    this._applyWithArgs("token", "while");
                    this._applyWithArgs("token", "(");
                    c = this._apply("expr");
                    this._applyWithArgs("token", ")");
                    this._apply("sc");
                    return ["doWhile", s, c]
                }.call(this)
            }, function () {
                return function () {
                    this._applyWithArgs("token", "for");
                    this._applyWithArgs("token", "(");
                    i = this._or(function () {
                        return function () {
                            this._applyWithArgs("token", "var");
                            return this._apply("binding")
                        }.call(this)
                    }, function () {
                        return this._apply("expr")
                    }, function () {
                        return function () {
                            this._apply("empty");
                            return ["get", "undefined"]
                        }.call(this)
                    });
                    this._applyWithArgs("token", ";");
                    c = this._or(function () {
                        return this._apply("expr")
                    }, function () {
                        return function () {
                            this._apply("empty");
                            return ["get", "true"]
                        }.call(this)
                    });
                    this._applyWithArgs("token", ";");
                    u = this._or(function () {
                        return this._apply("expr")
                    }, function () {
                        return function () {
                            this._apply("empty");
                            return ["get", "undefined"]
                        }.call(this)
                    });
                    this._applyWithArgs("token", ")");
                    s = this._apply("stmt");
                    return ["for", i, c, u, s]
                }.call(this)
            }, function () {
                return function () {
                    this._applyWithArgs("token", "for");
                    this._applyWithArgs("token", "(");
                    v = this._or(function () {
                        return function () {
                            this._applyWithArgs("token", "var");
                            n = this._applyWithArgs("token", "name");
                            return ["var", n, ["get", "undefined"]]
                        }.call(this)
                    }, function () {
                        return this._apply("expr")
                    });
                    this._applyWithArgs("token", "in");
                    e = this._apply("expr");
                    this._applyWithArgs("token", ")");
                    s = this._apply("stmt");
                    return ["forIn", v, e, s]
                }.call(this)
            }, function () {
                return function () {
                    this._applyWithArgs("token", "switch");
                    this._applyWithArgs("token", "(");
                    e = this._apply("expr");
                    this._applyWithArgs("token", ")");
                    this._applyWithArgs("token", "{");
                    cs = this._many(function () {
                        return this._or(function () {
                            return function () {
                                this._applyWithArgs("token", "case");
                                c = this._apply("expr");
                                this._applyWithArgs("token", ":");
                                cs = this._apply("srcElems");
                                return ["case", c, cs]
                            }.call(this)
                        }, function () {
                            return function () {
                                this._applyWithArgs("token", "default");
                                this._applyWithArgs("token", ":");
                                cs = this._apply("srcElems");
                                return ["default", cs]
                            }.call(this)
                        })
                    });
                    this._applyWithArgs("token", "}");
                    return ["switch", e].concat(cs)
                }.call(this)
            }, function () {
                return function () {
                    this._applyWithArgs("token", "break");
                    this._apply("sc");
                    return ["break"]
                }.call(this)
            }, function () {
                return function () {
                    this._applyWithArgs("token", "continue");
                    this._apply("sc");
                    return ["continue"]
                }.call(this)
            }, function () {
                return function () {
                    this._applyWithArgs("token", "throw");
                    this._apply("spacesNoNl");
                    e = this._apply("expr");
                    this._apply("sc");
                    return ["throw", e]
                }.call(this)
            }, function () {
                return function () {
                    this._applyWithArgs("token", "try");
                    t = this._apply("block");
                    this._applyWithArgs("token", "catch");
                    this._applyWithArgs("token", "(");
                    e = this._applyWithArgs("token", "name");
                    this._applyWithArgs("token", ")");
                    c = this._apply("block");
                    f = this._or(function () {
                        return function () {
                            this._applyWithArgs("token", "finally");
                            return this._apply("block")
                        }.call(this)
                    }, function () {
                        return function () {
                            this._apply("empty");
                            return ["get", "undefined"]
                        }.call(this)
                    });
                    return ["try", t, e, c, f]
                }.call(this)
            }, function () {
                return function () {
                    this._applyWithArgs("token", "return");
                    e = this._or(function () {
                        return this._apply("expr")
                    }, function () {
                        return function () {
                            this._apply("empty");
                            return ["get", "undefined"]
                        }.call(this)
                    });
                    this._apply("sc");
                    return ["return", e]
                }.call(this)
            }, function () {
                return function () {
                    this._applyWithArgs("token", "with");
                    this._applyWithArgs("token", "(");
                    x = this._apply("expr");
                    this._applyWithArgs("token", ")");
                    s = this._apply("stmt");
                    return ["with", x, s]
                }.call(this)
            }, function () {
                return function () {
                    e = this._apply("expr");
                    this._apply("sc");
                    return e
                }.call(this)
            }, function () {
                return function () {
                    this._applyWithArgs("token", ";");
                    return ["get", "undefined"]
                }.call(this)
            })
        },
        "srcElem": function () {
            var n, f;
            return this._or(function () {
                return function () {
                    this._applyWithArgs("token", "function");
                    n = this._applyWithArgs("token", "name");
                    f = this._apply("funcRest");
                    return ["var", n, f]
                }.call(this)
            }, function () {
                return this._apply("stmt")
            })
        },
        "srcElems": function () {
            var ss;
            return function () {
                ss = this._many(function () {
                    return this._apply("srcElem")
                });
                return ["begin"].concat(ss)
            }.call(this)
        },
        "topLevel": function () {
            var r;
            return function () {
                r = this._apply("srcElems");
                this._apply("spaces");
                this._apply("end");
                return r
            }.call(this)
        }
    });
    BSJSParser["hexDigits"] = "0123456789abcdef";
    BSJSParser["keywords"] = {};
    var keywords = ["break", "case", "catch", "continue", "default", "delete", "do", "else", "finally", "for", "function", "if", "in", "instanceof", "new", "return", "switch", "this", "throw", "try", "typeof", "var", "void", "while", "with", "ometa"];
    for (var i = 0; i < keywords["length"]; i++) {
        BSJSParser["keywords"][keywords[i]] = true
    }
    BSJSParser["_isKeyword"] = function (k) {
        return this["keywords"].hasOwnProperty(k)
    };

    var BSSemActionParser = Object.inherit(BSJSParser, {
        "curlySemAction": function () {
            var r, s, ss, r, s;
            return this._or(function () {
                return function () {
                    this._applyWithArgs("token", "{");
                    r = this._apply("expr");
                    this._apply("sc");
                    this._applyWithArgs("token", "}");
                    this._apply("spaces");
                    return r
                }.call(this)
            }, function () {
                return function () {
                    this._applyWithArgs("token", "{");
                    ss = this._many(function () {
                        return function () {
                            s = this._apply("srcElem");
                            this._lookahead(function () {
                                return this._apply("srcElem")
                            });
                            return s
                        }.call(this)
                    });
                    s = this._or(function () {
                        return function () {
                            r = this._apply("expr");
                            this._apply("sc");
                            return ["return", r]
                        }.call(this)
                    }, function () {
                        return this._apply("srcElem")
                    });
                    ss.push(s);
                    this._applyWithArgs("token", "}");
                    this._apply("spaces");
                    return ["send", "call", ["func", [],
                        ["begin"].concat(ss)], ["this"]]
                }.call(this)
            })
        },
        "semAction": function () {
            var r;
            return this._or(function () {
                return this._apply("curlySemAction")
            }, function () {
                return function () {
                    r = this._apply("primExpr");
                    this._apply("spaces");
                    return r
                }.call(this)
            })
        }
    });
    var BSJSTranslator = Object.inherit(OMeta, {
        "trans": function () {
            var t, ans;
            return function () {
                this._form(function () {
                    return function () {
                        t = this._apply("anything");
                        return ans = this._applyWithArgs("apply", t)
                    }.call(this)
                });
                return ans
            }.call(this)
        },
        "curlyTrans": function () {
            var r, rs, r;
            return this._or(function () {
                return function () {
                    this._form(function () {
                        return function () {
                            this._applyWithArgs("exactly", "begin");
                            return r = this._apply("curlyTrans")
                        }.call(this)
                    });
                    return r
                }.call(this)
            }, function () {
                return function () {
                    this._form(function () {
                        return function () {
                            this._applyWithArgs("exactly", "begin");
                            return rs = this._many(function () {
                                return this._apply("trans")
                            })
                        }.call(this)
                    });
                    return "{" + rs.join(";") + "}"
                }.call(this)
            }, function () {
                return function () {
                    r = this._apply("trans");
                    return "{" + r + "}"
                }.call(this)
            })
        },
        "this": function () {
            return "this"
        },
        "break": function () {
            return "break"
        },
        "continue": function () {
            return "continue"
        },
        "number": function () {
            var n;
            return function () {
                n = this._apply("anything");
                return "(" + n + ")"
            }.call(this)
        },
        "string": function () {
            var s;
            return function () {
                s = this._apply("anything");
                return s.toProgramString()
            }.call(this)
        },
        "regExpr": function () {
            var x;
            return function () {
                x = this._apply("anything");
                return x
            }.call(this)
        },
        "arr": function () {
            var xs;
            return function () {
                xs = this._many(function () {
                    return this._apply("trans")
                });
                return "[" + xs.join(",") + "]"
            }.call(this)
        },
        "unop": function () {
            var op, x;
            return function () {
                op = this._apply("anything");
                x = this._apply("trans");
                return "(" + op + " " + x + ")"
            }.call(this)
        },
        "getp": function () {
            var fd, x;
            return function () {
                fd = this._apply("trans");
                x = this._apply("trans");
                return x + "[" + fd + "]"
            }.call(this)
        },
        "get": function () {
            var x;
            return function () {
                x = this._apply("anything");
                return x
            }.call(this)
        },
        "set": function () {
            var lhs, rhs;
            return function () {
                lhs = this._apply("trans");
                rhs = this._apply("trans");
                return "(" + lhs + "=" + rhs + ")"
            }.call(this)
        },
        "mset": function () {
            var lhs, op, rhs;
            return function () {
                lhs = this._apply("trans");
                op = this._apply("anything");
                rhs = this._apply("trans");
                return "(" + lhs + op + "=" + rhs + ")"
            }.call(this)
        },
        "binop": function () {
            var op, x, y;
            return function () {
                op = this._apply("anything");
                x = this._apply("trans");
                y = this._apply("trans");
                return "(" + x + " " + op + " " + y + ")"
            }.call(this)
        },
        "preop": function () {
            var op, x;
            return function () {
                op = this._apply("anything");
                x = this._apply("trans");
                return op + x
            }.call(this)
        },
        "postop": function () {
            var op, x;
            return function () {
                op = this._apply("anything");
                x = this._apply("trans");
                return x + op
            }.call(this)
        },
        "return": function () {
            var x;
            return function () {
                x = this._apply("trans");
                return "return " + x
            }.call(this)
        },
        "with": function () {
            var x, s;
            return function () {
                x = this._apply("trans");
                s = this._apply("curlyTrans");
                return "with(" + x + ")" + s
            }.call(this)
        },
        "if": function () {
            var cond, t, e;
            return function () {
                cond = this._apply("trans");
                t = this._apply("curlyTrans");
                e = this._apply("curlyTrans");
                return "if(" + cond + ")" + t + "else" + e
            }.call(this)
        },
        "condExpr": function () {
            var cond, t, e;
            return function () {
                cond = this._apply("trans");
                t = this._apply("trans");
                e = this._apply("trans");
                return "(" + cond + "?" + t + ":" + e + ")"
            }.call(this)
        },
        "while": function () {
            var cond, body;
            return function () {
                cond = this._apply("trans");
                body = this._apply("curlyTrans");
                return "while(" + cond + ")" + body
            }.call(this)
        },
        "doWhile": function () {
            var body, cond;
            return function () {
                body = this._apply("curlyTrans");
                cond = this._apply("trans");
                return "do" + body + "while(" + cond + ")"
            }.call(this)
        },
        "for": function () {
            var init, cond, upd, body;
            return function () {
                init = this._apply("trans");
                cond = this._apply("trans");
                upd = this._apply("trans");
                body = this._apply("curlyTrans");
                return "for(" + init + ";" + cond + ";" + upd + ")" + body
            }.call(this)
        },
        "forIn": function () {
            var x, arr, body;
            return function () {
                x = this._apply("trans");
                arr = this._apply("trans");
                body = this._apply("curlyTrans");
                return "for(" + x + " in " + arr + ")" + body
            }.call(this)
        },
        "begin": function () {
            var x, x, xs;
            return this._or(function () {
                return function () {
                    x = this._apply("trans");
                    this._apply("end");
                    return x
                }.call(this)
            }, function () {
                return function () {
                    xs = this._many(function () {
                        return function () {
                            x = this._apply("trans");
                            return this._or(function () {
                                return function () {
                                    this._or(function () {
                                        return this._pred(x[x["length"] - 1] == "}")
                                    }, function () {
                                        return this._apply("end")
                                    });
                                    return x
                                }.call(this)
                            }, function () {
                                return function () {
                                    this._apply("empty");
                                    return x + ";"
                                }.call(this)
                            })
                        }.call(this)
                    });
                    return "{" + xs.join("") + "}"
                }.call(this)
            })
        },
        "func": function () {
            var args, body;
            return function () {
                args = this._apply("anything");
                body = this._apply("curlyTrans");
                return "(function(" + args.join(",") + ")" + body + ")"
            }.call(this)
        },
        "call": function () {
            var fn, args;
            return function () {
                fn = this._apply("trans");
                args = this._many(function () {
                    return this._apply("trans")
                });
                return fn + "(" + args.join(",") + ")"
            }.call(this)
        },
        "send": function () {
            var msg, recv, args;
            return function () {
                msg = this._apply("anything");
                recv = this._apply("trans");
                args = this._many(function () {
                    return this._apply("trans")
                });
                return recv + "." + msg + "(" + args.join(",") + ")"
            }.call(this)
        },
        "new": function () {
            var cls, args;
            return function () {
                cls = this._apply("anything");
                args = this._many(function () {
                    return this._apply("trans")
                });
                return "new " + cls + "(" + args.join(",") + ")"
            }.call(this)
        },
        "var": function () {
            var name, val;
            return function () {
                name = this._apply("anything");
                val = this._apply("trans");
                return "var " + name + "=" + val
            }.call(this)
        },
        "throw": function () {
            var x;
            return function () {
                x = this._apply("trans");
                return "throw " + x
            }.call(this)
        },
        "try": function () {
            var x, name, c, f;
            return function () {
                x = this._apply("curlyTrans");
                name = this._apply("anything");
                c = this._apply("curlyTrans");
                f = this._apply("curlyTrans");
                return "try " + x + "catch(" + name + ")" + c + "finally" + f
            }.call(this)
        },
        "json": function () {
            var props;
            return function () {
                props = this._many(function () {
                    return this._apply("trans")
                });
                return "({" + props.join(",") + "})"
            }.call(this)
        },
        "binding": function () {
            var name, val;
            return function () {
                name = this._apply("anything");
                val = this._apply("trans");
                return name.toProgramString() + ": " + val
            }.call(this)
        },
        "switch": function () {
            var x, cases;
            return function () {
                x = this._apply("trans");
                cases = this._many(function () {
                    return this._apply("trans")
                });
                return "switch(" + x + "){" + cases.join(";") + "}"
            }.call(this)
        },
        "case": function () {
            var x, y;
            return function () {
                x = this._apply("trans");
                y = this._apply("trans");
                return "case " + x + ": " + y
            }.call(this)
        },
        "default": function () {
            var y;
            return function () {
                y = this._apply("trans");
                return "default: " + y
            }.call(this)
        }
    });
    var BSOMetaParser = Object.inherit(OMeta, {
        "space": function () {
            return this._or(function () {
                return OMeta._superApplyWithArgs(this, "space")
            }, function () {
                return this._applyWithArgs("fromTo", "//", "\n")
            }, function () {
                return this._applyWithArgs("fromTo", "/*", "*/")
            })
        },
        "nameFirst": function () {
            return this._or(function () {
                return function () {
                    switch (this._apply("anything")) {
                    case "_":
                        return "_";
                    case "$":
                        return "$";
                    default:
                        this.bt.mismatch("Fail")
                    }
                }.call(this)
            }, function () {
                return this._apply("letter")
            })
        },
        "nameRest": function () {
            return this._or(function () {
                return this._apply("nameFirst")
            }, function () {
                return this._apply("digit")
            })
        },
        "tsName": function () {
            return this._consumedBy(function () {
                return function () {
                    this._apply("nameFirst");
                    return this._many(function () {
                        return this._apply("nameRest")
                    })
                }.call(this)
            })
        },
        "name": function () {
            return function () {
                this._apply("spaces");
                return this._apply("tsName")
            }.call(this)
        },
        "eChar": function () {
            var c;
            return this._or(function () {
                return function () {
                    switch (this._apply("anything")) {
                    case "\\":
                        return function () {
                            c = this._apply("char");
                            return unescape("\\" + c)
                        }.call(this);
                    default:
                        this.bt.mismatch("Fail")
                    }
                }.call(this)
            }, function () {
                return this._apply("char")
            })
        },
        "tsString": function () {
            var xs;
            return function () {
                this._applyWithArgs("exactly", "'");
                xs = this._many(function () {
                    return function () {
                        this._not(function () {
                            return this._applyWithArgs("exactly", "'")
                        });
                        return this._apply("eChar")
                    }.call(this)
                });
                this._applyWithArgs("exactly", "'");
                return xs.join("")
            }.call(this)
        },
        "characters": function () {
            var xs;
            return function () {
                this._applyWithArgs("exactly", "`");
                this._applyWithArgs("exactly", "`");
                xs = this._many(function () {
                    return function () {
                        this._not(function () {
                            return function () {
                                this._applyWithArgs("exactly", "'");
                                return this._applyWithArgs("exactly", "'")
                            }.call(this)
                        });
                        return this._apply("eChar")
                    }.call(this)
                });
                this._applyWithArgs("exactly", "'");
                this._applyWithArgs("exactly", "'");
                return ["App", "seq", xs.join("").toProgramString()]
            }.call(this)
        },
        "sCharacters": function () {
            var xs;
            return function () {
                this._applyWithArgs("exactly", '"');
                xs = this._many(function () {
                    return function () {
                        this._not(function () {
                            return this._applyWithArgs("exactly", '"')
                        });
                        return this._apply("eChar")
                    }.call(this)
                });
                this._applyWithArgs("exactly", '"');
                return ["App", "token", xs.join("").toProgramString()]
            }.call(this)
        },
        "string": function () {
            var xs;
            return function () {
                xs = this._or(function () {
                    return function () {
                        (function () {
                            switch (this._apply("anything")) {
                            case "#":
                                return "#";
                            case "`":
                                return "`";
                            default:
                                this.bt.mismatch("Fail")
                            }
                        }).call(this);
                        return this._apply("tsName")
                    }.call(this)
                }, function () {
                    return this._apply("tsString")
                });
                return ["App", "exactly", xs.toProgramString()]
            }.call(this)
        },
        "number": function () {
            var n;
            return function () {
                n = this._consumedBy(function () {
                    return function () {
                        this._opt(function () {
                            return this._applyWithArgs("exactly", "-")
                        });
                        return this._many1(function () {
                            return this._apply("digit")
                        })
                    }.call(this)
                });
                return ["App", "exactly", n]
            }.call(this)
        },
        "keyword": function () {
            var xs;
            return function () {
                xs = this._apply("anything");
                this._applyWithArgs("token", xs);
                this._not(function () {
                    return this._apply("letterOrDigit")
                });
                return xs
            }.call(this)
        },
        "args": function () {
            var xs;
            return this._or(function () {
                return function () {
                    switch (this._apply("anything")) {
                    case "(":
                        return function () {
                            xs = this._applyWithArgs("listOf", "hostExpr", ",");
                            this._applyWithArgs("token", ")");
                            return xs
                        }.call(this);
                    default:
                        this.bt.mismatch("Fail")
                    }
                }.call(this)
            }, function () {
                return function () {
                    this._apply("empty");
                    return []
                }.call(this)
            })
        },
        "application": function () {
            var rule, as, grm, rule, as, rule, as;
            return this._or(function () {
                return function () {
                    this._applyWithArgs("token", "^");
                    rule = this._apply("name");
                    as = this._apply("args");
                    return ["App", "super", "'" + rule + "'"].concat(as)
                }.call(this)
            }, function () {
                return function () {
                    grm = this._apply("name");
                    this._applyWithArgs("token", ".");
                    rule = this._apply("name");
                    as = this._apply("args");
                    return ["App", "foreign", grm, "'" + rule + "'"].concat(as)
                }.call(this)
            }, function () {
                return function () {
                    rule = this._apply("name");
                    as = this._apply("args");
                    return ["App", rule].concat(as)
                }.call(this)
            })
        },
        "hostExpr": function () {
            var r;
            return function () {
                r = this._applyWithArgs("foreign", BSSemActionParser, "expr");
                return this._applyWithArgs("foreign", BSJSTranslator, "trans", r)
            }.call(this)
        },
        "curlyHostExpr": function () {
            var r;
            return function () {
                r = this._applyWithArgs("foreign", BSSemActionParser, "curlySemAction");
                return this._applyWithArgs("foreign", BSJSTranslator, "trans", r)
            }.call(this)
        },
        "primHostExpr": function () {
            var r;
            return function () {
                r = this._applyWithArgs("foreign", BSSemActionParser, "semAction");
                return this._applyWithArgs("foreign", BSJSTranslator, "trans", r)
            }.call(this)
        },
        "atomicHostExpr": function () {
            return this._or(function () {
                return this._apply("curlyHostExpr")
            }, function () {
                return this._apply("primHostExpr")
            })
        },
        "semAction": function () {
            var x, x;
            return this._or(function () {
                return function () {
                    x = this._apply("curlyHostExpr");
                    return ["Act", x]
                }.call(this)
            }, function () {
                return function () {
                    this._applyWithArgs("token", "!");
                    x = this._apply("atomicHostExpr");
                    return ["Act", x]
                }.call(this)
            })
        },
        "arrSemAction": function () {
            var x;
            return function () {
                this._applyWithArgs("token", "->");
                x = this._apply("atomicHostExpr");
                return ["Act", x]
            }.call(this)
        },
        "semPred": function () {
            var x;
            return function () {
                this._applyWithArgs("token", "?");
                x = this._apply("atomicHostExpr");
                return ["Pred", x]
            }.call(this)
        },
        "expr": function () {
            var x, xs, x, xs;
            return this._or(function () {
                return function () {
                    x = this._applyWithArgs("expr5", true);
                    xs = this._many1(function () {
                        return function () {
                            this._applyWithArgs("token", "|");
                            return this._applyWithArgs("expr5", true)
                        }.call(this)
                    });
                    return ["Or", x].concat(xs)
                }.call(this)
            }, function () {
                return function () {
                    x = this._applyWithArgs("expr5", true);
                    xs = this._many1(function () {
                        return function () {
                            this._applyWithArgs("token", "||");
                            return this._applyWithArgs("expr5", true)
                        }.call(this)
                    });
                    return ["XOr", x].concat(xs)
                }.call(this)
            }, function () {
                return this._applyWithArgs("expr5", false)
            })
        },
        "expr5": function () {
            var ne, x, xs;
            return function () {
                ne = this._apply("anything");
                return this._or(function () {
                    return function () {
                        x = this._apply("interleavePart");
                        xs = this._many1(function () {
                            return function () {
                                this._applyWithArgs("token", "&&");
                                return this._apply("interleavePart")
                            }.call(this)
                        });
                        return ["Interleave", x].concat(xs)
                    }.call(this)
                }, function () {
                    return this._applyWithArgs("expr4", ne)
                })
            }.call(this)
        },
        "interleavePart": function () {
            var part, part;
            return this._or(function () {
                return function () {
                    this._applyWithArgs("token", "(");
                    part = this._applyWithArgs("expr4", true);
                    this._applyWithArgs("token", ")");
                    return ["1", part]
                }.call(this)
            }, function () {
                return function () {
                    part = this._applyWithArgs("expr4", true);
                    return this._applyWithArgs("modedIPart", part)
                }.call(this)
            })
        },
        "modedIPart": function () {
            var part, part, part, part;
            return this._or(function () {
                return function () {
                    this._form(function () {
                        return function () {
                            this._applyWithArgs("exactly", "And");
                            return this._form(function () {
                                return function () {
                                    this._applyWithArgs("exactly", "Many");
                                    return part = this._apply("anything")
                                }.call(this)
                            })
                        }.call(this)
                    });
                    return ["*", part]
                }.call(this)
            }, function () {
                return function () {
                    this._form(function () {
                        return function () {
                            this._applyWithArgs("exactly", "And");
                            return this._form(function () {
                                return function () {
                                    this._applyWithArgs("exactly", "Many1");
                                    return part = this._apply("anything")
                                }.call(this)
                            })
                        }.call(this)
                    });
                    return ["+", part]
                }.call(this)
            }, function () {
                return function () {
                    this._form(function () {
                        return function () {
                            this._applyWithArgs("exactly", "And");
                            return this._form(function () {
                                return function () {
                                    this._applyWithArgs("exactly", "Opt");
                                    return part = this._apply("anything")
                                }.call(this)
                            })
                        }.call(this)
                    });
                    return ["?", part]
                }.call(this)
            }, function () {
                return function () {
                    part = this._apply("anything");
                    return ["1", part]
                }.call(this)
            })
        },
        "expr4": function () {
            var ne, xs, act, xs, xs;
            return function () {
                ne = this._apply("anything");
                return this._or(function () {
                    return function () {
                        xs = this._many(function () {
                            return this._apply("expr3")
                        });
                        act = this._apply("arrSemAction");
                        return ["And"].concat(xs).concat([act])
                    }.call(this)
                }, function () {
                    return function () {
                        this._pred(ne);
                        xs = this._many1(function () {
                            return this._apply("expr3")
                        });
                        return ["And"].concat(xs)
                    }.call(this)
                }, function () {
                    return function () {
                        this._pred(ne == false);
                        xs = this._many(function () {
                            return this._apply("expr3")
                        });
                        return ["And"].concat(xs)
                    }.call(this)
                })
            }.call(this)
        },
        "optIter": function () {
            var x;
            return function () {
                x = this._apply("anything");
                return this._or(function () {
                    return function () {
                        switch (this._apply("anything")) {
                        case "*":
                            return ["Many", x];
                        case "+":
                            return ["Many1", x];
                        case "?":
                            return ["Opt", x];
                        default:
                            this.bt.mismatch("Fail")
                        }
                    }.call(this)
                }, function () {
                    return function () {
                        this._apply("empty");
                        return x
                    }.call(this)
                })
            }.call(this)
        },
        "optBind": function () {
            var x, n;
            return function () {
                x = this._apply("anything");
                return this._or(function () {
                    return function () {
                        switch (this._apply("anything")) {
                        case ":":
                            return function () {
                                n = this._apply("name");
                                return function () {
                                    this["locals"].push(n);
                                    return ["Set", n, x]
                                }.call(this)
                            }.call(this);
                        default:
                            this.bt.mismatch("Fail")
                        }
                    }.call(this)
                }, function () {
                    return function () {
                        this._apply("empty");
                        return x
                    }.call(this)
                })
            }.call(this)
        },
        "expr3": function () {
            var n, x, e;
            return this._or(function () {
                return function () {
                    this._applyWithArgs("token", ":");
                    n = this._apply("name");
                    return function () {
                        this["locals"].push(n);
                        return ["Set", n, ["App", "anything"]]
                    }.call(this)
                }.call(this)
            }, function () {
                return function () {
                    e = this._or(function () {
                        return function () {
                            x = this._apply("expr2");
                            return this._applyWithArgs("optIter", x)
                        }.call(this)
                    }, function () {
                        return this._apply("semAction")
                    });
                    return this._applyWithArgs("optBind", e)
                }.call(this)
            }, function () {
                return this._apply("semPred")
            })
        },
        "expr2": function () {
            var x, x;
            return this._or(function () {
                return function () {
                    this._applyWithArgs("token", "~");
                    x = this._apply("expr2");
                    return ["Not", x]
                }.call(this)
            }, function () {
                return function () {
                    this._applyWithArgs("token", "&");
                    x = this._apply("expr1");
                    return ["Lookahead", x]
                }.call(this)
            }, function () {
                return this._apply("expr1")
            })
        },
        "expr1": function () {
            var x, x, x, x, x;
            return this._or(function () {
                return this._apply("application")
            }, function () {
                return function () {
                    x = this._or(function () {
                        return this._applyWithArgs("keyword", "undefined")
                    }, function () {
                        return this._applyWithArgs("keyword", "nil")
                    }, function () {
                        return this._applyWithArgs("keyword", "true")
                    }, function () {
                        return this._applyWithArgs("keyword", "false")
                    });
                    return ["App", "exactly", x]
                }.call(this)
            }, function () {
                return function () {
                    this._apply("spaces");
                    return this._or(function () {
                        return this._apply("characters")
                    }, function () {
                        return this._apply("sCharacters")
                    }, function () {
                        return this._apply("string")
                    }, function () {
                        return this._apply("number")
                    })
                }.call(this)
            }, function () {
                return function () {
                    this._applyWithArgs("token", "[");
                    x = this._apply("expr");
                    this._applyWithArgs("token", "]");
                    return ["Form", x]
                }.call(this)
            }, function () {
                return function () {
                    this._applyWithArgs("token", "<");
                    x = this._apply("expr");
                    this._applyWithArgs("token", ">");
                    return ["ConsBy", x]
                }.call(this)
            }, function () {
                return function () {
                    this._applyWithArgs("token", "@<");
                    x = this._apply("expr");
                    this._applyWithArgs("token", ">");
                    return ["IdxConsBy", x]
                }.call(this)
            }, function () {
                return function () {
                    this._applyWithArgs("token", "(");
                    x = this._apply("expr");
                    this._applyWithArgs("token", ")");
                    return x
                }.call(this)
            })
        },
        "ruleName": function () {
            return this._or(function () {
                return this._apply("name")
            }, function () {
                return function () {
                    this._apply("spaces");
                    return this._apply("tsString")
                }.call(this)
            })
        },
        "rule": function () {
            var n, x, xs;
            return function () {
                this._lookahead(function () {
                    return n = this._apply("ruleName")
                });
                this["locals"] = []; // TODO rewrite grammar
                x = this._applyWithArgs("rulePart", n);
                xs = this._many(function () {
                    return function () {
                        this._applyWithArgs("token", ",");
                        return this._applyWithArgs("rulePart", n)
                    }.call(this)
                });
                return ["Rule", n, this["locals"], ["Or", x].concat(xs)]
            }.call(this)
        },
        "rulePart": function () {
            var rn, n, b1, b2;
            return function () {
                rn = this._apply("anything");
                n = this._apply("ruleName");
                this._pred(n == rn);
                b1 = this._apply("expr4");
                return this._or(function () {
                    return function () {
                        this._applyWithArgs("token", "=");
                        b2 = this._apply("expr");
                        return ["And", b1, b2]
                    }.call(this)
                }, function () {
                    return function () {
                        this._apply("empty");
                        return b1
                    }.call(this)
                })
            }.call(this)
        },
        "grammar": function () {
            var n, sn, rs;
            return function () {
                this._applyWithArgs("keyword", "ometa");
                n = this._apply("name");
                sn = this._or(function () {
                    return function () {
                        this._applyWithArgs("token", "<:");
                        return this._apply("name")
                    }.call(this)
                }, function () {
                    return function () {
                        this._apply("empty");
                        return "OMeta"
                    }.call(this)
                });
                this._applyWithArgs("token", "{");
                rs = this._applyWithArgs("listOf", "rule", ",");
                this._applyWithArgs("token", "}");
                return this._applyWithArgs("foreign", BSOMetaOptimizer, "optimizeGrammar", ["Grammar", n, sn].concat(rs))
            }.call(this)
        }
    });
    var BSOMetaTranslator = Object.inherit(OMeta, {
        "App": function () {
            var args, rule, args, rule;
            return this._or(function () {
                return function () {
                    switch (this._apply("anything")) {
                    case "super":
                        return function () {
                            args = this._many1(function () {
                                return this._apply("anything")
                            });
                            return [this["sName"], "._superApplyWithArgs(this,", args.join(","), ")"].join("")
                        }.call(this);
                    default:
                        this.bt.mismatch("Fail")
                    }
                }.call(this)
            }, function () {
                return function () {
                    rule = this._apply("anything");
                    args = this._many1(function () {
                        return this._apply("anything")
                    });
                    return ['this._applyWithArgs("', rule, '",', args.join(","), ")"].join("")
                }.call(this)
            }, function () {
                return function () {
                    rule = this._apply("anything");
                    return ['this._apply("', rule, '")'].join("")
                }.call(this)
            })
        },
        "Act": function () {
            var expr;
            return function () {
                expr = this._apply("anything");
                return expr
            }.call(this)
        },
        "Pred": function () {
            var expr;
            return function () {
                expr = this._apply("anything");
                return ["this._pred(", expr, ")"].join("")
            }.call(this)
        },
        "Or": function () {
            var xs;
            return function () {
                xs = this._many(function () {
                    return this._apply("transFn")
                });
                return ["this._or(", xs.join(","), ")"].join("")
            }.call(this)
        },
        "XOr": function () {
            var xs;
            return function () {
                xs = this._many(function () {
                    return this._apply("transFn")
                });
                xs.unshift((this["name"] + "." + this["rName"]).toProgramString());
                return ["this._xor(", xs.join(","), ")"].join("")
            }.call(this)
        },
        "And": function () {
            var xs, y;
            return this._or(function () {
                return function () {
                    xs = this._many(function () {
                        return this._applyWithArgs("notLast", "trans")
                    });
                    y = this._apply("trans");
                    xs.push("return " + y);
                    return ["(function(){", xs.join(";"), "}).call(this)"].join("")
                }.call(this)
            }, function () {
                return "undefined"
            })
        },
        "Opt": function () {
            var x;
            return function () {
                x = this._apply("transFn");
                return ["this._opt(", x, ")"].join("")
            }.call(this)
        },
        "Many": function () {
            var x;
            return function () {
                x = this._apply("transFn");
                return ["this._many(", x, ")"].join("")
            }.call(this)
        },
        "Many1": function () {
            var x;
            return function () {
                x = this._apply("transFn");
                return ["this._many1(", x, ")"].join("")
            }.call(this)
        },
        "Set": function () {
            var n, v;
            return function () {
                n = this._apply("anything");
                v = this._apply("trans");
                return [n, "=", v].join("")
            }.call(this)
        },
        "Not": function () {
            var x;
            return function () {
                x = this._apply("transFn");
                return ["this._not(", x, ")"].join("")
            }.call(this)
        },
        "Lookahead": function () {
            var x;
            return function () {
                x = this._apply("transFn");
                return ["this._lookahead(", x, ")"].join("")
            }.call(this)
        },
        "Form": function () {
            var x;
            return function () {
                x = this._apply("transFn");
                return ["this._form(", x, ")"].join("")
            }.call(this)
        },
        "ConsBy": function () {
            var x;
            return function () {
                x = this._apply("transFn");
                return ["this._consumedBy(", x, ")"].join("")
            }.call(this)
        },
        "IdxConsBy": function () {
            var x;
            return function () {
                x = this._apply("transFn");
                return ["this._idxConsumedBy(", x, ")"].join("")
            }.call(this)
        },
        "JumpTable": function () {
            var cases;
            return function () {
                cases = this._many(function () {
                    return this._apply("jtCase")
                });
                return this.jumpTableCode(cases)
            }.call(this)
        },
        "Interleave": function () {
            var xs;
            return function () {
                xs = this._many(function () {
                    return this._apply("intPart")
                });
                return ["this._interleave(", xs.join(","), ")"].join("")
            }.call(this)
        },
        "Rule": function () {
            var name, ls, body;
            return function () {
                name = this._apply("anything");
                this["rName"] = name;
                ls = this._apply("locals");
                body = this._apply("trans");
                return ['\n"', name, '":function(){', ls, "return ", body, "}"].join("")
            }.call(this)
        },
        "Grammar": function () {
            var name, sName, rules;
            return function () {
                name = this._apply("anything");
                sName = this._apply("anything");
                this["name"] = name;
                this["sName"] = sName;
                rules = this._many(function () {
                    return this._apply("trans")
                });
                return ["var ", name, "=Object.inherit(", sName, ",{", rules.join(","), "})"].join("")
            }.call(this)
        },
        "intPart": function () {
            var mode, part;
            return function () {
                this._form(function () {
                    return function () {
                        mode = this._apply("anything");
                        return part = this._apply("transFn")
                    }.call(this)
                });
                return mode.toProgramString() + "," + part
            }.call(this)
        },
        "jtCase": function () {
            var x, e;
            return function () {
                this._form(function () {
                    return function () {
                        x = this._apply("anything");
                        return e = this._apply("trans")
                    }.call(this)
                });
                return [x.toProgramString(), e]
            }.call(this)
        },
        "locals": function () {
            var vs;
            return this._or(function () {
                return function () {
                    this._form(function () {
                        return vs = this._many1(function () {
                            return this._apply("string")
                        })
                    });
                    return vs.length > 0 ? ["var ", vs.join(","), ";"].join("") : ""; // TODO - rewrite grammar
                }.call(this)
            }, function () {
                return function () {
                    this._form(function () {
                        return undefined
                    });
                    return ""
                }.call(this)
            })
        },
        "trans": function () {
            var t, ans;
            return function () {
                this._form(function () {
                    return function () {
                        t = this._apply("anything");
                        return ans = this._applyWithArgs("apply", t)
                    }.call(this)
                });
                return ans
            }.call(this)
        },
        "transFn": function () {
            var x;
            return function () {
                x = this._apply("trans");
                return ["(function(){return ", x, "})"].join("")
            }.call(this)
        }
    });
    BSOMetaTranslator["jumpTableCode"] = function (cases) {
        var buf = new StringBuffer;
        buf.nextPutAll("(function(){switch(this._apply('anything')){");
        for (var i = 0; i < cases["length"]; i += 1) {
            buf.nextPutAll("case " + cases[i][0] + ":return " + cases[i][1] + ";")
        }
        buf.nextPutAll("default: this.bt.mismatch()}}).call(this)");
        return buf.contents()
    };

    var BSOMetaJSParser = Object.inherit(BSJSParser, {
        "srcElem": function () {
            var r;
            return this._or(function () {
                return function () {
                    this._apply("spaces");
                    r = this._applyWithArgs("foreign", BSOMetaParser, "grammar");
                    this._apply("sc");
                    return r
                }.call(this)
            }, function () {
                return BSJSParser._superApplyWithArgs(this, "srcElem")
            })
        }
    });


    var BSOMetaJSTranslator = Object.inherit(BSJSTranslator, {
        "Grammar": function () {
            return this._applyWithArgs("foreign", BSOMetaTranslator, "Grammar")
        }
    });
    var BSNullOptimization = Object.inherit(OMeta, {
        "setHelped": function () {
            return this["_didSomething"] = true
        },
        "helped": function () {
            return this._pred(this["_didSomething"])
        },
        "trans": function () {
            var t, ans;
            return function () {
                this._form(function () {
                    return function () {
                        t = this._apply("anything");
                        this._pred(this[t] != undefined);
                        return ans = this._applyWithArgs("apply", t)
                    }.call(this)
                });
                return ans
            }.call(this)
        },
        "optimize": function () {
            var x;
            return function () {
                x = this._apply("trans");
                this._apply("helped");
                return x
            }.call(this)
        },
        "App": function () {
            var rule, args;
            return function () {
                rule = this._apply("anything");
                args = this._many(function () {
                    return this._apply("anything")
                });
                return ["App", rule].concat(args)
            }.call(this)
        },
        "Act": function () {
            var expr;
            return function () {
                expr = this._apply("anything");
                return ["Act", expr]
            }.call(this)
        },
        "Pred": function () {
            var expr;
            return function () {
                expr = this._apply("anything");
                return ["Pred", expr]
            }.call(this)
        },
        "Or": function () {
            var xs;
            return function () {
                xs = this._many(function () {
                    return this._apply("trans")
                });
                return ["Or"].concat(xs)
            }.call(this)
        },
        "XOr": function () {
            var xs;
            return function () {
                xs = this._many(function () {
                    return this._apply("trans")
                });
                return ["XOr"].concat(xs)
            }.call(this)
        },
        "And": function () {
            var xs;
            return function () {
                xs = this._many(function () {
                    return this._apply("trans")
                });
                return ["And"].concat(xs)
            }.call(this)
        },
        "Opt": function () {
            var x;
            return function () {
                x = this._apply("trans");
                return ["Opt", x]
            }.call(this)
        },
        "Many": function () {
            var x;
            return function () {
                x = this._apply("trans");
                return ["Many", x]
            }.call(this)
        },
        "Many1": function () {
            var x;
            return function () {
                x = this._apply("trans");
                return ["Many1", x]
            }.call(this)
        },
        "Set": function () {
            var n, v;
            return function () {
                n = this._apply("anything");
                v = this._apply("trans");
                return ["Set", n, v]
            }.call(this)
        },
        "Not": function () {
            var x;
            return function () {
                x = this._apply("trans");
                return ["Not", x]
            }.call(this)
        },
        "Lookahead": function () {
            var x;
            return function () {
                x = this._apply("trans");
                return ["Lookahead", x]
            }.call(this)
        },
        "Form": function () {
            var x;
            return function () {
                x = this._apply("trans");
                return ["Form", x]
            }.call(this)
        },
        "ConsBy": function () {
            var x;
            return function () {
                x = this._apply("trans");
                return ["ConsBy", x]
            }.call(this)
        },
        "IdxConsBy": function () {
            var x;
            return function () {
                x = this._apply("trans");
                return ["IdxConsBy", x]
            }.call(this)
        },
        "JumpTable": function () {
            var c, e, ces;
            return function () {
                ces = this._many(function () {
                    return function () {
                        this._form(function () {
                            return function () {
                                c = this._apply("anything");
                                return e = this._apply("trans")
                            }.call(this)
                        });
                        return [c, e]
                    }.call(this)
                });
                return ["JumpTable"].concat(ces)
            }.call(this)
        },
        "Interleave": function () {
            var m, p, xs;
            return function () {
                xs = this._many(function () {
                    return function () {
                        this._form(function () {
                            return function () {
                                m = this._apply("anything");
                                return p = this._apply("trans")
                            }.call(this)
                        });
                        return [m, p]
                    }.call(this)
                });
                return ["Interleave"].concat(xs)
            }.call(this)
        },
        "Rule": function () {
            var name, ls, body;
            return function () {
                name = this._apply("anything");
                ls = this._apply("anything");
                body = this._apply("trans");
                return ["Rule", name, ls, body]
            }.call(this)
        }
    });
    BSNullOptimization["initialize"] = function () {
        this["_didSomething"] = false
    };

    var BSAssociativeOptimization = Object.inherit(BSNullOptimization, {
        "And": function () {
            var x, xs;
            return this._or(function () {
                return function () {
                    x = this._apply("trans");
                    this._apply("end");
                    this._apply("setHelped");
                    return x
                }.call(this)
            }, function () {
                return function () {
                    xs = this._applyWithArgs("transInside", "And");
                    return ["And"].concat(xs)
                }.call(this)
            })
        },
        "Or": function () {
            var x, xs;
            return this._or(function () {
                return function () {
                    x = this._apply("trans");
                    this._apply("end");
                    this._apply("setHelped");
                    return x
                }.call(this)
            }, function () {
                return function () {
                    xs = this._applyWithArgs("transInside", "Or");
                    return ["Or"].concat(xs)
                }.call(this)
            })
        },
        "XOr": function () {
            var x, xs;
            return this._or(function () {
                return function () {
                    x = this._apply("trans");
                    this._apply("end");
                    this._apply("setHelped");
                    return x
                }.call(this)
            }, function () {
                return function () {
                    xs = this._applyWithArgs("transInside", "XOr");
                    return ["XOr"].concat(xs)
                }.call(this)
            })
        },
        "transInside": function () {
            var t, xs, ys, x, xs;
            return function () {
                t = this._apply("anything");
                return this._or(function () {
                    return function () {
                        this._form(function () {
                            return function () {
                                this._applyWithArgs("exactly", t);
                                return xs = this._applyWithArgs("transInside", t)
                            }.call(this)
                        });
                        ys = this._applyWithArgs("transInside", t);
                        this._apply("setHelped");
                        return xs.concat(ys)
                    }.call(this)
                }, function () {
                    return function () {
                        x = this._apply("trans");
                        xs = this._applyWithArgs("transInside", t);
                        return [x].concat(xs)
                    }.call(this)
                }, function () {
                    return []
                })
            }.call(this)
        }
    });

    var BSSeqInliner = Object.inherit(BSNullOptimization, {
        "App": function () {
            var s, cs, rule, args;
            return this._or(function () {
                return function () {
                    switch (this._apply("anything")) {
                    case "seq":
                        return function () {
                            s = this._apply("anything");
                            this._apply("end");
                            cs = this._applyWithArgs("seqString", s);
                            this._apply("setHelped");
                            return ["And"].concat(cs).concat([
                                ["Act", s]
                            ])
                        }.call(this);
                    default:
                        this.bt.mismatch("Fail")
                    }
                }.call(this)
            }, function () {
                return function () {
                    rule = this._apply("anything");
                    args = this._many(function () {
                        return this._apply("anything")
                    });
                    return ["App", rule].concat(args)
                }.call(this)
            })
        },
        "inlineChar": function () {
            var c;
            return function () {
                c = this._applyWithArgs("foreign", BSOMetaParser, "eChar");
                this._not(function () {
                    return this._apply("end")
                });
                return ["App", "exactly", c.toProgramString()]
            }.call(this)
        },
        "seqString": function () {
            var s, cs, cs;
            return function () {
                this._lookahead(function () {
                    return function () {
                        s = this._apply("anything");
                        return this._pred(typeof s === "string")
                    }.call(this)
                });
                return this._or(function () {
                    return function () {
                        this._form(function () {
                            return function () {
                                this._applyWithArgs("exactly", '"');
                                cs = this._many(function () {
                                    return this._apply("inlineChar")
                                });
                                return this._applyWithArgs("exactly", '"')
                            }.call(this)
                        });
                        return cs
                    }.call(this)
                }, function () {
                    return function () {
                        this._form(function () {
                            return function () {
                                this._applyWithArgs("exactly", "'");
                                cs = this._many(function () {
                                    return this._apply("inlineChar")
                                });
                                return this._applyWithArgs("exactly", "'")
                            }.call(this)
                        });
                        return cs
                    }.call(this)
                })
            }.call(this)
        }
    });

    var JumpTable = function (choiceOp, choice) {
            this["choiceOp"] = choiceOp;
            this["choices"] = {};
            this.add(choice)
        };
    JumpTable["prototype"]["add"] = function (choice) {
        var c = choice[0];
        var t = choice[1];
        if (this["choices"][c]) {
            if (this["choices"][c][0] == this["choiceOp"]) {
                this["choices"][c].push(t)
            } else {
                this["choices"][c] = [this["choiceOp"], this["choices"][c], t]
            }
        } else {
            this["choices"][c] = t
        }
    };
    JumpTable["prototype"]["toTree"] = function () {
        var r = ["JumpTable"];
        var choiceKeys = Object.getOwnPropertyNames(this["choices"]);
        for (var i = 0; i < choiceKeys["length"]; i += 1) {
            r.push([choiceKeys[i], this["choices"][choiceKeys[i]]])
        }
        return r
    };

    var BSJumpTableOptimization = Object.inherit(BSNullOptimization, {
        "Or": function () {
            var cs;
            return function () {
                cs = this._many(function () {
                    return this._or(function () {
                        return this._applyWithArgs("jtChoices", "Or")
                    }, function () {
                        return this._apply("trans")
                    })
                });
                return ["Or"].concat(cs)
            }.call(this)
        },
        "XOr": function () {
            var cs;
            return function () {
                cs = this._many(function () {
                    return this._or(function () {
                        return this._applyWithArgs("jtChoices", "XOr")
                    }, function () {
                        return this._apply("trans")
                    })
                });
                return ["XOr"].concat(cs)
            }.call(this)
        },
        "quotedString": function () {
            var c, cs, c, cs;
            return function () {
                this._lookahead(function () {
                    return this._apply("string")
                });
                this._form(function () {
                    return function () {
                        switch (this._apply("anything")) {
                        case '"':
                            return function () {
                                cs = this._many(function () {
                                    return function () {
                                        c = this._applyWithArgs("foreign", BSOMetaParser, "eChar");
                                        this._not(function () {
                                            return this._apply("end")
                                        });
                                        return c
                                    }.call(this)
                                });
                                return this._applyWithArgs("exactly", '"')
                            }.call(this);
                        case "'":
                            return function () {
                                cs = this._many(function () {
                                    return function () {
                                        c = this._applyWithArgs("foreign", BSOMetaParser, "eChar");
                                        this._not(function () {
                                            return this._apply("end")
                                        });
                                        return c
                                    }.call(this)
                                });
                                return this._applyWithArgs("exactly", "'")
                            }.call(this);
                        default:
                            this.bt.mismatch("Fail")
                        }
                    }.call(this)
                });
                return cs.join("")
            }.call(this)
        },
        "jtChoice": function () {
            var x, rest, x;
            return this._or(function () {
                return function () {
                    this._form(function () {
                        return function () {
                            this._applyWithArgs("exactly", "And");
                            this._form(function () {
                                return function () {
                                    this._applyWithArgs("exactly", "App");
                                    this._applyWithArgs("exactly", "exactly");
                                    return x = this._apply("quotedString")
                                }.call(this)
                            });
                            return rest = this._many(function () {
                                return this._apply("anything")
                            })
                        }.call(this)
                    });
                    return [x, ["And"].concat(rest)]
                }.call(this)
            }, function () {
                return function () {
                    this._form(function () {
                        return function () {
                            this._applyWithArgs("exactly", "App");
                            this._applyWithArgs("exactly", "exactly");
                            return x = this._apply("quotedString")
                        }.call(this)
                    });
                    return [x, ["Act", x.toProgramString()]]
                }.call(this)
            })
        },
        "jtChoices": function () {
            var op, c, jt, c;
            return function () {
                op = this._apply("anything");
                c = this._apply("jtChoice");
                jt = new JumpTable(op, c);
                this._many(function () {
                    return function () {
                        c = this._apply("jtChoice");
                        return jt.add(c)
                    }.call(this)
                });
                this._apply("setHelped");
                return jt.toTree()
            }.call(this)
        }
    });

    var BSOMetaOptimizer = Object.inherit(OMeta, {
        "optimizeGrammar": function () {
            var n, sn, rs;
            return function () {
                this._form(function () {
                    return function () {
                        this._applyWithArgs("exactly", "Grammar");
                        n = this._apply("anything");
                        sn = this._apply("anything");
                        return rs = this._many(function () {
                            return this._apply("optimizeRule")
                        })
                    }.call(this)
                });
                return ["Grammar", n, sn].concat(rs)
            }.call(this)
        },
        "optimizeRule": function () {
            var r, r, r, r;
            return function () {
                r = this._apply("anything");
                this._or(function () {
                    return r = this._applyWithArgs("foreign", BSSeqInliner, "optimize", r)
                }, function () {
                    return this._apply("empty")
                });
                this._many(function () {
                    return this._or(function () {
                        return r = this._applyWithArgs("foreign", BSAssociativeOptimization, "optimize", r)
                    }, function () {
                        return r = this._applyWithArgs("foreign", BSJumpTableOptimization, "optimize", r)
                    })
                });
                return r
            }.call(this)
        }
    });

    return {
        parser: BSOMetaJSParser,
        translator: BSOMetaJSTranslator
    }

})();


/**
 * 4. Module Exports
 */
module.exports = {
    parser: ometa_compiler.parser,
    translator: ometa_compiler.translator
/*,
  BSJSParser: BSJSParser,
  BSJSTranslator: BSJSTranslator,
  BSOMetaParser: BSOMetaParser,
  BSOMetaTranslator: BSOMetaTranslator*/
}
