var fs = require("fs");
var path = require("path");
var readline = require("readline");
var canvas = require("canvas");

jcond {
    fogOnly: jsys.type == "fog";
    deviceOnly: jsys.type == "device";
}

jdata {
    char* targs as logger;
}

var devDist = 200;
var devRange = 125;
var devCoords = {x: devRange, y: 0};

function initDevRange() {
    var seqNum = parseInt(jsys.tags, 10);
    devCoords.x = seqNum * devDist + devRange;
    devCoords.y = 0;
}

function inDevRange(coords) {
    var dist = calcDist(coords, devCoords);
    return dist <= devRange;
}

var loadFlightData = (() => {
    var NUM_TIMESTEPS = 250;
    var TIMESTEP = 30; // seconds
    var X_OFFSET = devDist + devRange;
    var Y_OFFSET = 0;
    var INFINITY = 2 * (devRange + devDist) + 100;

    function haversineDistance(lat1, lon1, lat2, lon2) {
        if (lat1 === lat2 && lon1 === lon2) {
            return 0;
        }
        var radlat1 = lat1 * Math.PI / 180;
        var radlat2 = lat2 * Math.PI / 180;
        var theta = lon1 - lon2;
        var radtheta = theta * Math.PI / 180;
        var dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
        if (dist > 1) {
            dist = 1;
        }
        dist = Math.acos(dist);
        dist = dist * 180 / Math.PI;
        dist = dist * 60 * 1.1515;
        dist = dist * 1.609344; // km
        return dist;
    }

    function getPrev(arr, i) {
        do {
            i--;
        } while (i >= 0 && (arr[i].x === undefined || arr[i].y === undefined));
        return arr[i];
    }

    function getNext(arr, i) {
        do {
            i++;
        } while (i < arr.length && (arr[i].x === undefined || arr[i].y === undefined));
        return arr[i];
    }

    return (fileName, isArrival, tOffset) => {
        var data = [];
        var map = new Map();

        var rl = readline.createInterface({
            input: fs.createReadStream(fileName)
        });

        var firstLine = true;
        var checkZeroAltitude = true;
        var initTimestamp = 0;
        var initLatitude = 0;
        var initLongitude = 0;
        rl.on("line", line => {
            if (firstLine) {
                firstLine = false;
                return;
            }
            var parts = line.split(",");
            var timestamp = parseInt(parts[0], 10);
            var latitude = parseFloat(parts[3].substring(1));
            var longitude = parseFloat(parts[4].substring(0, parts[4].length - 1));
            var altitude = parseInt(parts[5], 10);
            if (checkZeroAltitude && (altitude === 0 || map.size === 0)) {
                initTimestamp = timestamp;
                initLatitude = latitude;
                initLongitude = longitude;
                map.set(0, {x: 0, y: 0});
            } else {
                var offset = timestamp - initTimestamp;
                var latitudeDistance = haversineDistance(initLatitude, initLongitude, latitude, initLongitude);
                var y = latitude > initLatitude ? latitudeDistance : -latitudeDistance;
                var longitudeDistance = haversineDistance(initLatitude, initLongitude, initLatitude, longitude);
                var x = longitude > initLongitude ? longitudeDistance : -longitudeDistance;
                map.set(offset, {x: x, y: y});
                checkZeroAltitude = false;
            }
        });

        rl.on("close", () => {
            // add map entries for missing offsets
            for (var i = 0; i < NUM_TIMESTEPS; i++) {
                var offset = i * TIMESTEP;
                if (!map.has(offset)) {
                    map.set(offset, {x: undefined, y: undefined});
                }
            }
            // convert map to array sorted by offset
            var arr = [];
            var iter = map.entries();
            for (var entry = iter.next(); !entry.done; entry = iter.next()) {
                var offset = entry.value[0];
                var coords = entry.value[1];
                arr.push({offset: offset, x: coords.x, y: coords.y});
            }
            arr.sort((elem1, elem2) => elem1.offset - elem2.offset);
            map = undefined; // gc
            // compute coordinates for missing offsets
            for (var i = 1; i < arr.length; i++) {
                var curr = arr[i];
                if (curr.x === undefined || curr.y === undefined) {
                    var prev = getPrev(arr, i);
                    var next = getNext(arr, i);
                    if (next !== undefined) {
                        var frac = (curr.offset - prev.offset) / (next.offset - prev.offset);
                        curr.x = prev.x + frac * (next.x - prev.x);
                        curr.y = prev.y + frac * (next.y - prev.y);
                    } else {
                        curr.x = prev.x;
                        curr.y = prev.y;
                    }
                }
            }
            // keep only entries for timesteps
            for (var i = 0; i < arr.length; i++) {
                var obj = arr[i];
                if (obj.offset % TIMESTEP === 0) {
                    var last = data.length - 1;
                    if (last >= 0 && data[last].x === obj.x && data[last].y === obj.y) {
                        break;
                    }
                    data.push(obj);
                }
            }
            // make all coordinates relative to last point if arrival
            if (isArrival) {
                var last = data.length - 1;
                var lastX = data[last].x;
                var lastY = data[last].y;
                for (var i = 0; i < data.length; i++) {
                    data[i].x -= lastX;
                    data[i].y -= lastY;
                }
            }
        });

        return t => {
            t -= tOffset;
            var x = INFINITY;
            var y = INFINITY;
            if (t >= 0 && t < data.length) {
                x = data[t].x;
                y = data[t].y;
            }
            return {x: x + X_OFFSET, y: y + Y_OFFSET};
        };
    };
})();

var targetFuncs = [
    /*
    t => {
        var a = 0.001; // scale
        var b = 325; // horizontal shift
        var c = 40; // vertical shift
        var x = -25 + 3 * t;
        var y = a * (x - b) * (x - b) + c;
        return {x: x, y: y};
    },
    t => {
        var a = 35; // amplitude
        var b = 2 * Math.PI / 700; // 2 * Math.PI / period
        var c = 125; // phase shift
        var d = -5; // vertical shift
        var x = -15 + 5 * t;
        var y = a * Math.sin(b * (x + c)) + d;
        return {x: x, y: y};
    },
    t => {
        var x = 745 - 4 * t;
        var y = 70 - t;
        return {x: x, y: y};
    },
    */
    /*
    t => {
        var x = 15 + 5 * t;
        var y = 0.35 * x - 125;
        return {x: x, y: y};
    },
    t => {
        var x = 15 + 5 * t;
        var y = -0.35 * x + 125;
        return {x: x, y: y};
    },
    */
    loadFlightData("LH900_FRA_LHR.csv", false, 10),
    loadFlightData("LH1392_FRA_PRG.csv", false, 30),
    loadFlightData("LH1186_FRA_ZRH.csv", false, 50),
    loadFlightData("LH215_DRE_FRA.csv", true, 0),
    loadFlightData("LH93_MUC_FRA.csv", true, 60),
    loadFlightData("AF1018_CDG_FRA.csv", true, 70),
];

var t = -1;

jasync {deviceOnly} function startTracking() {
    if (t > -1) {
        return;
    }
    function f() {
        t++;
        identifyTargets();
        setTimeout(f, 500);
    }
    f();
}

jsync {deviceOnly} function pullTargets() {
    var targets = identifyTargets();
    return JSON.stringify(targets);
}

function identifyTargets() {
    console.log("Identifying targets", t);
    var targets = [];
    for (var i = 0; i < targetFuncs.length; i++) {
        var coords = targetFuncs[i](t);
        if (inDevRange(coords)) {
            var target = identifyTarget(coords);
            var velocity = target.velocity;
            if (target.id !== "UNKNOWN" && (target.coords.x !== coords.x || target.coords.y !== coords.y)) {
                var dx = coords.x - target.coords.x;
                var dy = coords.y - target.coords.y;
                velocity = {x: dx, y: dy};
            }
            targets.push({id: target.id, coords: coords, velocity: velocity});
        }
    }
    for (var i = 0; i < targets.length; i++) {
        var target = targets[i];
        if (model.has(target.id)) {
            model.set(target.id, target);
        }
    }
    console.log(model);
    return targets;
}

function identifyTarget(coords) {
    var target = identifyTargetByVelocity(coords);
    if (target.id === "UNKNOWN") {
        target = identifyTargetByProximity(coords);
    }
    return target;
}

function identifyTargetByVelocity(coords) {
    var nearestTarget = {id: "UNKNOWN"};
    var minDist = 15;
    var iter = model.values();
    for (var value = iter.next(); !value.done; value = iter.next()) {
        var target = value.value;
        if (target.velocity !== undefined) {
            var expectedTargetXCoord = target.coords.x + target.velocity.x;
            var expectedTargetYCoord = target.coords.y + target.velocity.y;
            var expectedTargetCoords = {x: expectedTargetXCoord, y: expectedTargetYCoord};
            var dist = calcDist(coords, expectedTargetCoords);
            if (dist <= minDist) {
                minDist = dist;
                nearestTarget = target;
            }
        }
    }
    return nearestTarget;
}

function identifyTargetByProximity(coords) {
    var nearestTarget = {id: "UNKNOWN"};
    var minDist = 25;
    var iter = model.values();
    for (var value = iter.next(); !value.done; value = iter.next()) {
        var target = value.value;
        var dist = calcDist(coords, target.coords);
        if (dist <= minDist) {
            minDist = dist;
            nearestTarget = target;
        }
    }
    return nearestTarget;
}

function calcDist(coords1, coords2) {
    var xDiff = coords1.x - coords2.x;
    var yDiff = coords1.y - coords2.y;
    var euclideanDist = Math.sqrt(xDiff * xDiff + yDiff * yDiff);
    return euclideanDist;
}

var makeId = (() => {
    var idx = 0;
    var ids = ["LH900", "LH215", "LH1392", "LH1186", "LH93", "AF1018"];
    var letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    var digits = "0123456789";

    return length => {
        /*
        if (idx < ids.length) {
            return ids[idx++];
        }
        */
        var id = "";
        for (var i = 0; i < 2; i++) {
            id += letters.charAt(Math.floor(Math.random() * letters.length));
        }
        for (var i = 0; i < length - 2; i++) {
            id += digits.charAt(Math.floor(Math.random() * digits.length));
        }
        return id;
    };
})();

var model = new Map();
var modelSeqNum = -1;

jasync {deviceOnly} function pushModel(m, mSeqNum) {
    if (mSeqNum <= modelSeqNum) {
        return;
    }
    modelSeqNum = mSeqNum;
    model.clear();
    for (var i = 0; i < m.length; i++) {
        var target = m[i];
        model.set(target.id, target);
    }
}

var drawVisualization = (() => {
    var canvasFile = "track.svg";
    fs.unlink(canvasFile, () => {});

    var devs = [
        {
            id: "dev0",
            coords: {x: 0 * devDist + devRange, y: 0}
        },
        {
            id: "dev1",
            coords: {x: 1 * devDist + devRange, y: 0}
        },
        {
            id: "dev2",
            coords: {x: 2 * devDist + devRange, y: 0}
        },
    ];

    var getColor = (() => {
        var idx = 0;
        var colors = ["Blue", "Green", "Red", "SaddleBrown", "Purple", "DarkOrange"];
        var idToColor = new Map();

        return id => {
            var color = idToColor.get(id);
            if (color === undefined) {
                color = colors[idx];
                idx = (idx + 1) % colors.length;
                idToColor.set(id, color);
            }
            return color;
        };
    })();

    function initCanvas(cvs, drawLabels, labelOffset) {
        var ctx = cvs.getContext("2d");
        ctx.font = "10px Arial";
        ctx.textAlign = "center";
        ctx.setLineDash([4, 4]);
        for (var i = 0; i < devs.length; i++) {
            var dev = devs[i];
            var color = "DimGray";
            ctx.beginPath();
            ctx.arc(dev.coords.x, devRange - dev.coords.y, devRange, 0, 2 * Math.PI);
            ctx.strokeStyle = color;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(dev.coords.x, devRange - dev.coords.y, 1.5, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();
            if (drawLabels) {
                ctx.fillText(dev.id, dev.coords.x, devRange - dev.coords.y + labelOffset);
            }
        }
        ctx.setLineDash([]);
    }

    function updateCanvas(cvs, currModel, prevModel, drawLabels, labelOffset) {
        var prevTargs = new Map();
        if (prevModel) {
            for (var i = 0; i < prevModel.length; i++) {
                var prevTar = prevModel[i];
                prevTargs.set(prevTar.id, prevTar.coords);
            }
        }
        var ctx = cvs.getContext("2d");
        for (var i = 0; i < currModel.length; i++) {
            var tar = currModel[i];
            var color = getColor(tar.id);
            ctx.beginPath();
            ctx.arc(tar.coords.x, devRange - tar.coords.y, 1.5, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();
            if (drawLabels) {
                ctx.fillText(tar.id, tar.coords.x, devRange - tar.coords.y + labelOffset);
            }
            var prevCoords = prevTargs.get(tar.id);
            if (prevCoords !== undefined) {
                ctx.beginPath();
                ctx.moveTo(prevCoords.x, devRange - prevCoords.y);
                ctx.lineTo(tar.coords.x, devRange - tar.coords.y);
                ctx.strokeStyle = color;
                ctx.stroke();
            } else {
                prevCoords = {x: devDist + devRange, y: 0};
                var dist = calcDist(prevCoords, tar.coords);
                if (dist <= 25) {
                    ctx.beginPath();
                    ctx.arc(prevCoords.x, devRange - prevCoords.y, 1.5, 0, 2 * Math.PI);
                    ctx.fillStyle = color;
                    ctx.fill();
                    ctx.beginPath();
                    ctx.moveTo(prevCoords.x, devRange - prevCoords.y);
                    ctx.lineTo(tar.coords.x, devRange - tar.coords.y);
                    ctx.strokeStyle = color;
                    ctx.stroke();
                }
            }
        }
    }

    function saveCanvas(cvs) {
        fs.writeFile(canvasFile, cvs.toBuffer(), () => {});
    }

    return () => {
        var sharedStream = targs.getSharedStream();
        var models = sharedStream.values();
        var cvs = canvas.createCanvas((devs.length - 1) * devDist + 2 * devRange, 2 * devRange, "svg");
        initCanvas(cvs, true, -10);
        for (var i = 0; i < models.length; i++) {
            models[i] = JSON.parse(models[i]);
            updateCanvas(cvs, models[i], models[i - 1], i === models.length - 1, 15);
        }
        saveCanvas(cvs);
    };
})();

function callback(context) {
    console.log("Collecting targets from devices for context", context.contextId);
    if (context.contextId == jsys.tags) {
        return;
    }
    jsys.sleep(500);
    console.log("Resolving ambiguities/conflicts and saving model");
    var sharedStream = targs.getSharedStream(context);
    sharedStream.log(deviceStreams => {
        var targets = [];
        for (var i = 0; i < deviceStreams.length; i++) {
            var lastValue = deviceStreams[i].lastValue();
            if (lastValue !== null) {
                targets.push(JSON.parse(lastValue));
            }
        }
        console.log("targets:", JSON.stringify(targets, null, 2));
        var coordsToTarget = new Map();
        for (var i = 0; i < targets.length; i++) {
            for (var j = 0; j < targets[i].length; j++) {
                var target = targets[i][j];
                var key = target.coords.x + "," + target.coords.y;
                var targ = coordsToTarget.get(key);
                if (targ === undefined || targ.id === "UNKNOWN") {
                    coordsToTarget.set(key, target);
                }
            }
        }
        var m = [];
        var iter = coordsToTarget.values();
        for (var value = iter.next(); !value.done; value = iter.next()) {
            var target = value.value;
            if (target.id === "UNKNOWN") {
                target.id = makeId(5);
            }
            m.push(target);
        }
        console.log("model:", JSON.stringify(m, null, 2));
        pushModel(m, context.contextId);
        setTimeout(drawVisualization, 500);
        return JSON.stringify(m);
    });
}

function updateModel() {
    log(__filename, "worker", "J2C sync activity started");
    var c = collect_targets(jsys.id, callback);
    c.then(
        res => {
            log(__filename, "worker", "J2C sync activity result: " + res);
            setTimeout(updateModel, 500);
        },
        err => {
            log(__filename, "worker", "J2C sync activity error: " + err);
            setTimeout(updateModel, 500);
        }
    );
}

function log(fileName, processType, message) {
    var timestamp = process.hrtime.bigint().toString();
    fileName = path.basename(fileName);
    console.log(timestamp, "[" + processType + ":" + fileName + "]", message);
}

switch (jsys.type) {
    case "fog":
        setTimeout(startTracking, 9000);
        setTimeout(updateModel, 10000);
        break;
    case "device":
        initDevRange();
        break;
}
