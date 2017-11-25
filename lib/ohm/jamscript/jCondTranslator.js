var jConditions = new Map();

var jCondTranslator = {
    Jcond_expr_paran: function(_1, expr, _2) {
        return {
            source: "(" + expr.jCondTranslator.source + ")",
            code: expr.jCondTranslator.code,
            cback: expr.jCondTranslator.cback
        };
    },
    Jcond_expr_not: function(_, expr) {
        return {
            source: "!" + expr.jCondTranslator.source,
            code: expr.jCondTranslator.code ^ 31,
            cback: expr.jCondTranslator.cback
        };
    },
    Jcond_expr_bin_op: function(expr1, op, expr2) {
        return {
            source: expr1.jCondTranslator.source + " " + op.sourceString + " " + expr2.jCondTranslator.source,
            code: expr1.jCondTranslator.code | expr2.jCondTranslator.code,
            cback: expr1.jCondTranslator.cback
        };
    },
    Jcond_expr_namespace: function(namespace, _, id) {
        return {
            source: `jcond.get('${namespace.sourceString}.${id.sourceString}').source`,
            code: jConditions.get(namespace.sourceString + "." + id.sourceString).code,
            cback: `jcond.get('${namespace.sourceString}.${id.sourceString}').cback`,            
        }
        return '';

    },
    Jcond_expr: function(node) {
        return node.jCondTranslator;
    },
    Jcond_expr_id: function(id) {
        if (jConditions.get(id.sourceString) == undefined) {
            throw ("jcond specification {" + id.sourceString + "} not found");
        }
        return {
            source: `jcond.get('${id.sourceString}').source`,
            code: jConditions.get(id.sourceString).code,
            cback: `jcond.get('${id.sourceString}').cback`
        };
    },
    Jcond_specifier: function(_1, jconds, _2) {
        return jconds.jCondTranslator;
    }
};

module.exports = {
    set: function(key, value) {
        jConditions.set(key, value);
    },
    jCondTranslator: jCondTranslator
};
