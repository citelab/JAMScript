jcond {
    fogOnly: jsys.type == "fog";
}

jdata {
    char* x as logger;
}

jsync function c2j_sync(inContext) {
    if (inContext) {
        console.log("C2J sync activity called inside context");
    } else {
        console.log("C2J sync activity called outside context");
    }
    var y = x.getSharedStream();
    var v = y.lastValue();
    return v !== null ? v : "null";
}

jasync {fogOnly} function j2j_async(deviceId) {
    console.log("J2J async activity called from device", deviceId);
    var y = x.getPrivateStream(deviceId);
    y.log(streams => {
        console.log("stream ids:", streams.map(stream => stream.getDeviceId()));
        var v = streams
            .map(stream => stream.lastValue())
            .filter(value => value !== null)
            .join("");
        console.log("log entry:", v);
        return v;
    });
}

function callback(context) {
    console.log("Executing J2C sync activity callback for context", context.contextId);
    console.log("context:", context);

    for (var i = 0; i < 3; i++) {
        console.log("Working on iteration", i);
        j2c_async(jsys.id);
        jsys.sleep(2000);
    }

    console.log("Logging result");
    var y = x.getSharedStream(context);
    y.log(streams => {
        console.log("stream ids:", streams.map(stream => stream.getDeviceId()));
        var v = context.contextId + "-" +
            streams
            .map(stream => stream.lastValue())
            .filter(value => value !== null)
            .join("");
        console.log("log entry:", v);
        return v;
    });
}

function f() {
    var c = j2c_sync_ctx(jsys.id, callback);
    c.then(
        res => console.log("J2C sync activity result:", res),
        err => console.log("J2C sync activity error:", err)
    );
    /*
    var c0 = j2c_sync_ctx(jsys.id, callback);
    c0.then(
        res => {
            console.log("J2C sync activity result 0:", res);
            var c1 = j2c_sync_ctx(jsys.id, callback);
            c1.then(
                res => {
                    console.log("J2C sync activity result 1:", res);
                    var c2 = j2c_sync_ctx(jsys.id, callback);
                    c2.then(
                        res => {
                            console.log("J2C sync activity result 2:", res);
                        },
                        err => {
                            console.log("J2C sync activity error 2:", err);
                        }
                    );
                },
                err => {
                    console.log("J2C sync activity error 1:", err);
                }
            );
        },
        err => {
            console.log("J2C sync activity error 0:", err);
        }
    );
    */
    /*
    var c0 = j2c_sync_ctx(jsys.id, callback);
    c0.then(
        res => console.log("J2C sync activity result 0:", res),
        err => console.log("J2C sync activity error 0:", err)
    );
    var c1 = j2c_sync_ctx(jsys.id, callback);
    c1.then(
        res => console.log("J2C sync activity result 1:", res),
        err => console.log("J2C sync activity error 1:", err)
    );
    var c2 = j2c_sync_ctx(jsys.id, callback);
    c2.then(
        res => console.log("J2C sync activity result 2:", res),
        err => console.log("J2C sync activity error 2:", err)
    );
    */
    /*
    var c0 = j2c_sync_ctx(jsys.id, callback);
    c0.then(res => {
        console.log("J2C sync activity result 0:", res);
        var c1 = j2c_sync_ctx(jsys.id, callback);
        return c1;
    }).then(res => {
        console.log("J2C sync activity result 1:", res);
        var c2 = j2c_sync_ctx(jsys.id, callback);
        return c2;
    }).then(res => {
        console.log("J2C sync activity result 2:", res);
        var c3 = j2c_sync_ctx(jsys.id, callback);
        return c3;
    }).then(res => {
        console.log("J2C sync activity result 3:", res);
        var c4 = j2c_sync_ctx(jsys.id, callback);
        return c4;
    }).then(res => {
        console.log("J2C sync activity result 4:", res);
        var c5 = j2c_sync_ctx(jsys.id, callback);
        return c5;
    }).then(res => {
        console.log("J2C sync activity result 5:", res);
        var c6 = j2c_sync_ctx(jsys.id, callback);
        return c6;
    }).then(res => {
        console.log("J2C sync activity result 6:", res);
        var c7 = j2c_sync_ctx(jsys.id, callback);
        return c7;
    }).then(res => {
        console.log("J2C sync activity result 7:", res);
    }).catch(err => {
        console.log("J2C sync activity error:", err);
    });
    */
}

if (jsys.type === "fog") {
    setTimeout(f, 10000);
} else if (jsys.type === "device") {
    var y = x.getMyDataStream();
    setInterval(() => y.log("J"), 3000);
    // setInterval(() => j2j_async(jsys.id), 10000);
}
