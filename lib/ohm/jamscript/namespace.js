// Global registry for namespace translation across all files

const reserved_names = ["japp", "jsys", "jtest", "global"];

let nameregistries = new Set();
let namespaces = new Set(reserved_names);

module.exports = {
    currentNamespace: "japp",
    names: new Map(),
    registerName: function(name, namespace, prototype=false) {
        if (namespace.includes("__"))
            console.log("WARN: including `__` in namespace specification could lead to ambiguous naming");
        if (!namespaces.has(namespace))
            namespaces.add(namespace);
        this.validateDeclaration(name);
        let newName = "__jname__" + namespace + "__" + name;
        if (!prototype) { // We can have multiple prototype definitions...
            if (nameregistries.has(newName))
                throw `ERROR: could not register "${name}" in "${namespace}" because such a registry already exists`;
            nameregistries.add(newName);
        }
        if (!this.names.has(namespace))
            this.names.set(namespace, new Map([[name, newName]]));
        else if (!this.names.get(namespace).has(name))
            this.names.get(namespace).set(name, newName);
        return newName;
    },
    validateDeclaration: function(name) {
        if (namespaces.has(name))
            throw `ERROR: declaration of ${name} conflicts with a namespace`;
    },
    hasNamespace: function(namespace) {
        return namespaces.has(namespace);
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
