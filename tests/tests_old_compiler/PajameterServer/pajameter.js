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

const boundedDelayMax = 1;

let logicalIdCount = 0;

let data = [[1, 2, 3, 4],
            [5, 6, 7, 8],
            [9, 10, 11, 12],
            [13, 14, 15, 16]];

let inProgress = [];

const nodeDatas = new Map();
const dataInProgress = new Map();
let dataCount = 0;


jcond {
    fogOnly(me, you) {
        return jsys.type === "fog";
    }
    deviceOnly(me, you) {
        return jsys.type === "device";
    }
}

jsync unsigned long long int {deviceOnly} getLogicalIdLocal() {
    while(1) {
        var lidhandle = getLogicalId();
        try {
            var logicalId = await lidhandle.next();
            lidhandle.return();
            return logicalId.value;
        } catch(e) {
            console.log(e.message, "... retrying");
        }
        await jsys.sleep(100);
    }
}


jsync unsigned long long int {fogOnly} getLogicalId() {
    logicalIdCount++;
    console.log("registered node with logical id", logicalIdCount);

    nodeDatas.set(logicalIdCount, new Set());

    return logicalIdCount;
}

jsync int[128] {deviceOnly} getNextDataLocal(logicalId: int) {
    while(1) {
        var dathandle = getNextData(logicalId);
        try {
            var data = await dathandle.next(logicalId);
            dathandle.return();
            console.log(data.value);
            return data.value;
        } catch(e) {
            console.log(e.message, "... retrying");
        }
        await jsys.sleep(100);
    }
}

jsync int[128] {fogOnly} getNextData(logicalId: int) {
    if (data.length > 0) {
        if (nodeDatas.get(logicalId).size < boundedDelayMax) {
            let dataTag = dataCount++;

            nodeDatas.get(logicalId).add(dataTag);

            let vec = data.pop();
            vec.push(dataTag);

            dataInProgress.set(dataTag, vec);
            console.log("assigning data", dataTag, vec, "to", logicalId);
            return vec;
        } else
            await jsys.sleep(1000);
    }
    return [];
}

async function aggregateUpdates() {
    console.log("waiting to aggregate updates", data.length, dataInProgress.size);
    console.log("where did it go?");
    while (data.length > 0 || dataInProgress.size > 0) {
        console.log("waiting for gradient updates...");
        var gradient_updates = await gradients.readLast();
        console.log(gradient_updates);
    }
}

if (jsys.type === "fog") {
    await jsys.sleep(100);
    aggregateUpdates();
}
