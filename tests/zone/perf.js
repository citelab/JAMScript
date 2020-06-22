// =============================================================================
// Performance tests for j2c_sync_ctx and j2c_sync with callback
// =============================================================================

var path = require("path");

var N = 1; // iterations
var T = 500; // milliseconds

function j2c_sync_with_callback(j2c_sync, args, callback) {
    var promise = callback();
    var result = j2c_sync.apply(null, args);
    return promise.then(() => result.device);
}

function j2c_sync_callback() {
    return new Promise(resolve => {
        function loop(start, stop) {
            if (start >= stop) {
                resolve();
                return;
            }
            log(__filename, "worker", "Working on iteration " + start);
            setTimeout(() => loop(start + 1, stop), T);
        }
        setTimeout(() => {
            log(__filename, "worker", "Executing J2C sync activity callback");
            loop(0, N);
        }, 0);
    });
}

function j2c_sync_ctx_callback(context) {
    log(__filename, "worker", "Executing J2C sync activity callback for context " + context.contextId);
    if (context.contextId == jsys.tags) {
        return;
    }
    for (var i = 0; i < N; i++) {
        log(__filename, "worker", "Working on iteration " + i);
        jsys.sleep(T);
    }
}

function f() {
    log(__filename, "worker", "J2C sync activity started");
    // var c = j2c_sync_with_callback(j2c_sync, [jsys.id], j2c_sync_callback);
    var c = j2c_sync_ctx(jsys.id, j2c_sync_ctx_callback);
    c.then(
        res => {
            log(__filename, "worker", "J2C sync activity result: " + res);
            f();
        },
        err => {
            log(__filename, "worker", "J2C sync activity error: " + err);
            f();
        }
    );
}

function log(fileName, processType, message) {
    var timestamp = process.hrtime.bigint().toString();
    fileName = path.basename(fileName);
    console.log(timestamp, "[" + processType + ":" + fileName + "]", message);
}

if (jsys.type === "fog") {
    setTimeout(f, 10000);
}
