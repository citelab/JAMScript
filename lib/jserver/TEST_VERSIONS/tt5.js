function checkArgsType(args, mask) {
    
    if (args.length !== mask.length)
        return false;
    
    for (m in mask) {
        switch (mask[m]) {
            case 's':
                if (typeof(args[m]) !== 'string')
                    return false;
                break;
            case 'i':
                if (typeof(args[m]) !== 'number')
                    return false;
                break;
        }
    }
    return true;
}

console.log(checkArgsType([1, 3], "ii"));
console.log(checkArgsType([1, 3], "i"));
console.log(checkArgsType([1, "hello"], "is"));
console.log(checkArgsType([1, "hello"], "si"));
console.log(checkArgsType(["h1", "hello"], "si"));
console.log(checkArgsType(["h1", "hello"], "ss"));
console.log(checkArgsType(["h1", "hello"], "ssi"));

