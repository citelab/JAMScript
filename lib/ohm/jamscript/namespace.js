// Global registry for namespace translation across all files

const reserved_names = ["japp", "jsys", "jtest", "global"];

let nameregistries = new Set();
let namespaces = new Set(reserved_names);

module.exports = {
    currentNamespace: "japp",
    names: new Map(),
    registerNamespace: function(namespace) {
        if (reserved_names.includes(namespace))
            throw `ERROR: cannot create namespace "${namespace}" as it is reserved`;
        if (!namespaces.has(namespace)) {
            if (namespace.includes("__"))
                console.log("WARN: including `__` in namespace could lead to ambiguous naming");
            namespaces.add(namespace);
        }
    },
    registerName: function(name, namespace, prototype=false) {
        if (!namespaces.has(namespace))
            throw `ERROR: registering name to unknown namespace "${namespace}"`
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