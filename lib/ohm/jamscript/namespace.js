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
    registerSubNamespace: function(subnamespace, namespace) {
        if (reserved_names.includes(subnamespace))
            throw `ERROR: cannot create subnamespace "${namespace}" as it is reserved`;
        if (!namespaces.has(namespace))
            throw `ERROR: registering subnamespace to unknown namespace "${namespace}"`
        let subName = namespace + "__" + subnamespace;
        if (!namespaces.has(subName)) {
            if (subnamespace.includes("__"))
                console.log("WARN: including `__` in subnamespace could lead to ambiguous naming");
            namespaces.add(subName);

            let registryName = "__jname__" + subName;
            if (nameregistries.has(registryName))
                throw `ERROR: could not register "${name}" in "${namespace}" because such a registry already exists`;
            nameregistries.add(registryName);

            if (!this.names.has(namespace))
                this.names.set(namespace, new Map([[subnamespace, subName]]));
            else
                this.names.get(namespace).set(name, newName);
        }
        return subName;
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
        return namespaces.has(namespace) || namespaces.has(this.currentNamespace + "__" + namespace);
    },
    translateAccess: function(name, namespace=null) {
        if(!namespace) {
            let scope = this.names.get(this.currentNamespace);
            return scope.has(name) ? scope.get(name) : name;
        }
        if (namespace === "global")
            return name;
        let longnamespace = this.currentNamespace + "__" + namespace;
        let scope = this.names.get(this.names.has(longnamespace) ? longnamespace : namespace);
        if (scope == undefined || !scope.has(name))
            throw `ERROR: cannot resolve the namespace access ${namespace}.${name}`;
        return scope.get(name);
    },
};
