let nameregistries = new Set();

module.exports = {
    currentNamespace: "japp",
    names: new Map(),
    registerName: function(name, namespace) {
        if (namespace.includes("__"))
            console.log("WARN: including `__` in namespace specification could lead to ambiguous naming");
        let newName = "__jname__" + namespace + "__" + funcname;
        if (nameregistries.has(newName))
            throw `ERROR: could not register "${name}" in "${namespace}" because such a registry already exists`;
        nameregistries.add(newName);
        if (!this.names.has(namespace))
            this.names.set(namespace, new Map());
        this.names.get(namespace).set(name, newName);
        return newName;
    },
    translateAccess: function(name, namespace=null) {
        if (namespace === "global")
            return name;
        let scope = this.names.get(namespace || this.currentNamespace);
        if (scope == undefined || !scope.has(name))
            if (!namespace)
                return name; // Assume a global call
            else
                throw "ERROR: cannot resolve the namespace access ${namespace}.${name}";
        return scope.get(name);
    },
};
