japp nspc {
    required_linker_flags: -lm;
}

jdata {
    struct gradient_update_t {
        int dataTag;
        unsigned long long int logicalId;
        int gradient[128];
    } gradients as uflow;
}


async function readGradients() {
    console.log("Reading the gradients...");
    while (1) {
        console.log("waiting for gradient updates...");
        var gradient_updates = await gradients.readLast();
        console.log("Got updates ..", gradient_updates);
    }
}

if (jsys.type === 'fog')
    readGradients();

