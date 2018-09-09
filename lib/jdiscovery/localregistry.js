//==============================================================================
// Registers a node locally (using local storage)
//==============================================================================

var LocalStorage = require('node-localstorage').LocalStorage,
    lockFile = require('lockfile'),
    constants = require('../jamserver/constants'),
    Registry = require('./registry'),
    os = require('os');

/* create an mDNS advertisement on the local network */

function LocalRegistry(app, machType, id, port) {
    Registry.call(this, app, machType, id, port);
    this.localStorage = null;
    this.binName = this._getBinName();
    // put the 'app' as a hidden directory in user's home
    this.appDir = os.homedir() + '/.' + app;
    // the timestamp when we last scanned local storage for other nodes;
    // set to zero to catch nodes that started before this node
    this.lastScanAt = 0;
    this.currentOfflineMachs = {};

    /**
     * Attributes to write to local storage the next time we check in. A map from
     * attribute name to { payload: attribute_value, dedupeId: deduplication_id }
     * objects.
     */
    this.attrsToAdd = {};
    // attributes to remove from local storage the next time we check in
    this.attrsToRemove = [];
    // attributes to discover the next time we scan
    this.attrsToDiscover = {
        device: {},
        fog: {},
        cloud: {}
    };

    // the previous devices, fogs, and clouds we found in local storage
    this.prevMachs = {};

    // whether or not scanning and checkins have been started
    this.started = false;
}

/* LocalRegistry inherits from Registry */
LocalRegistry.prototype = Object.create(Registry.prototype);
LocalRegistry.prototype.constructor = LocalRegistry;

/**
 * API for local storage registration/discovery
 */
LocalRegistry.prototype.registerAndDiscover = function() {
    if (!this.started) {
        // initialize the local storage
        var self = this;
        this._initLocalStorage(this, function() {
            self.started = true;
            self._kickStartCheckIns(self);
            self._kickStartScanning(self);
        });
    }
}

LocalRegistry.prototype._initLocalStorage = function(self, cb) {
    lockFile.lock(constants.localStorage.initLock, { stale: constants.localStorage.stale }, function (err) {
        if (err) {
            // failed to acquire lock, which means someone else already has it; wait until the node with the lock
            // has finished initializing local storage
            grabbedLock = false;
            var tempLs;
            while (true) {
                tempLs = new LocalStorage(self.appDir);
                if (tempLs.getItem('initialized')) {
                    self.localStorage = tempLs;
                    break;
                }
            }
            self.emit('ls-initialized');
            cb();
            return;
        }

        // we've grabbed the lock
        self.localStorage = new LocalStorage(self.appDir);
        if (!self.localStorage.getItem('initialized')) {
            // we need to perform the initialization
            for (var i = 0; i < constants.localStorage.numBins; i++) {
                self.localStorage.setItem('devices_' + i, '{}');
                self.localStorage.setItem('fogs_' + i, '{}');
                self.localStorage.setItem('clouds_' + i, '{}');
            }
            self.localStorage.setItem('initialized', 'true');
        }
        lockFile.unlockSync(constants.localStorage.initLock);
        self.emit('ls-initialized');
        cb();
    });
}

/**
 * Register a node on local storage by having it write itself into local storage (fogs and clouds only)
 */
LocalRegistry.prototype._kickStartCheckIns = function(self) {
    // create an object to be written to local storage
    var now = Date.now();
    var data = {
        lastCheckIn: now,
        createdAt: now
    };

    // add attrs
    for (var attr in self.attrsToAdd) {
        if (self.attrsToAdd[attr].payload instanceof Function) {
            data[attr] = {
                payload: self.attrsToAdd[attr].payload(),
                id: self.attrsToAdd[attr].dedupeId,
                updatedAt: now
            };
        } else {
            data[attr] = {
                payload: self.attrsToAdd[attr].payload,
                id: self.attrsToAdd[attr].dedupeId,
                updatedAt: now
            };
        }
    }
    // reset attrsToAdd
    self.attrsToAdd = {};

    self._addNodeToLocalStorage(self, data, 1, function() {
        // check in every so often to indicate that we're still here
        setInterval(self._checkIn, constants.localStorage.checkInInterval, self, 1);
    });
}

/**
 * Kick-start scanning
 */
LocalRegistry.prototype._kickStartScanning = function(self) {
    self._scan(self);
    setInterval(self._scan, constants.localStorage.scanInterval, self);
}

/**
 * Adds a node's information to local storage
 */
LocalRegistry.prototype._addNodeToLocalStorage = function(self, data, attemptNumber, cb) {
    if (self.binName !== undefined) {
        lockFile.lock(self.binName, { stale: constants.localStorage.stale }, function (err) {
            if (err) {
                setTimeout(self._addNodeToLocalStorage, self._getWaitTime(attemptNumber), self, data, attemptNumber + 1, cb);
                return;
            }
            var nodes = JSON.parse(self.localStorage.getItem(self.binName));
            nodes[self.id] = data;
            self.localStorage.setItem(self.binName, JSON.stringify(nodes));
            lockFile.unlockSync(self.binName);
            cb();
        });
    }
}

/**
 * Update lastCheckIn field
 * Also, at this time, we update the attributes of the node
 */
LocalRegistry.prototype._checkIn = function(self, attemptNumber) {
    lockFile.lock(self.binName, { stale: constants.localStorage.stale }, function (err) {
        if (err) {
            setTimeout(self._checkIn, self._getWaitTime(attemptNumber), self, attemptNumber + 1);
            return;
        }
        var now = Date.now();
        var nodes = JSON.parse(self.localStorage.getItem(self.binName));
        // update lastCheckIn field
        nodes[self.id].lastCheckIn = now;
        // update attributes
        // remove any that need removing
        for (var i = 0; i < self.attrsToRemove.length; i++) {
            delete nodes[self.id][self.attrsToRemove[i]];
        }
        // reset attrsToRemove
        self.attrsToRemove = [];
        // add any that need adding
        for (var attr in self.attrsToAdd) {
            if (self.attrsToAdd[attr].payload instanceof Function) {
                nodes[self.id][attr] = {
                    payload: self.attrsToAdd[attr].payload(),
                    id: self.attrsToAdd[attr].dedupeId,
                    updatedAt: now
                };
            } else {
                nodes[self.id][attr] = {
                    payload: self.attrsToAdd[attr].payload,
                    id: self.attrsToAdd[attr].dedupeId,
                    updatedAt: now
                };
            }
            delete self.attrsToAdd[attr];
        }
        self.localStorage.setItem(self.binName, JSON.stringify(nodes));
        lockFile.unlockSync(self.binName);
    });
}

/**
 * Scans local storage for other nodes
 */
LocalRegistry.prototype._scan = function(self) {
    var binName;
    var baseName;
    var currMachs = {};
    var machs;

    if (Object.keys(self.attrsToDiscover.device).length !== 0) {
        baseName = 'devices_';
        for (var i = 0; i < constants.localStorage.numBins; i++) {
            binName = baseName + i;
            machs = JSON.parse(self.localStorage.getItem(binName));
            self._makeDiscoveries(self, machs, self.attrsToDiscover.device);
            self._detectRemovedAttrs(self, machs, self.attrsToDiscover.device);
            for (var key in machs) {
                currMachs[key] = machs[key];
            }
        }
    }

    if (Object.keys(self.attrsToDiscover.fog).length !== 0) {
        baseName = 'fogs_';
        for (var i = 0; i < constants.localStorage.numBins; i++) {
            binName = baseName + i;
            machs = JSON.parse(self.localStorage.getItem(binName));
            self._makeDiscoveries(self, machs, self.attrsToDiscover.fog);
            self._detectRemovedAttrs(self, machs, self.attrsToDiscover.fog);
            for (var key in machs) {
                currMachs[key] = machs[key];
            }
        }
    }

    if (Object.keys(self.attrsToDiscover.cloud).length !== 0) {
        baseName = 'clouds_';
        for (var i = 0; i < constants.localStorage.numBins; i++) {
            binName = baseName + i;
            machs = JSON.parse(self.localStorage.getItem(binName));
            self._makeDiscoveries(self, machs, self.attrsToDiscover.cloud);
            self._detectRemovedAttrs(self, machs, self.attrsToDiscover.cloud);
            for (var key in machs) {
                currMachs[key] = machs[key];
            }
        }
    }

    self.prevMachs = currMachs;

    // update when we last scanned
    self.lastScanAt = Date.now();
}

LocalRegistry.prototype._makeDiscoveries = function(self, machs, dattrs) {
    // only the machs that are newly online are of interest to us, unless we are interested in node status,
    // in which case newly offline nodes are also of interest
    var now = Date.now();
    for (var machId in machs) {
        for (var attr in dattrs) {
            if (attr === 'status') {
                // check if the node has gone offline
                if ((now - machs[machId].lastCheckIn) > 2 * constants.localStorage.checkInInterval) {
                    // if we haven't already noted that the machine is offline...
                    if (!self.currentOfflineMachs[machId]) {
                        self.currentOfflineMachs[machId] = true;
                        // pass a dedupeId of zero for node down events
                        self.emit('discovery', 'status', dattrs[attr].offline, machId, 'offline', 0);
                    }
                } else if (machs[machId].createdAt > self.lastScanAt) {
                    // the node is newly online (or was online before the current node went online)
                    self.emit('discovery', 'status', dattrs[attr].online, machId, machs[machId].status.payload, machs[machId].status.id);
                    // in case we currently have this node recorded as offline
                    delete self.currentOfflineMachs[machId];
                }
            } else {
                if (machs[machId].hasOwnProperty(attr) && machs[machId][attr].updatedAt > self.lastScanAt) {
                    self.emit('discovery', attr, dattrs[attr].onAdd, machId, machs[machId][attr].payload, machs[machId][attr].id);
                }
            }
        }
    }
}

LocalRegistry.prototype._detectRemovedAttrs = function(self, machs, dattrs) {
    // for each attribute to discover, see if it was there the last time we scanned local storage but is gone now
    for (var machId in machs) {
        for (var attr in dattrs) {
            if (self.prevMachs[machId] && self.prevMachs[machId][attr] && !machs[machId][attr]) {
                self.emit('attr-removed', attr, dattrs[attr].onRemove, machId);
            }
        }
    }
}

//==============================================================================
// Add and discover attributes
//==============================================================================

/**
 * Add custom, discoverable attributes on the node
 */
LocalRegistry.prototype.addAttributes = function(attrs, dedupeId) {
    for (var attr in attrs) {
        delete this.attrsToRemove[attr];
        this.attrsToAdd[attr] = { payload: attrs[attr], dedupeId: dedupeId };
    }
}

/**
 * Removes attrs, a list of attribute keys, from this node
 */
LocalRegistry.prototype.removeAttributes = function(attrs) {
    for (var i = 0; i < attrs.length; i++) {
        delete this.attrsToAdd[attrs[i]];
    }
    if (this.started) {
        this.attrsToRemove = this.attrsToRemove.concat(attrs);
    }
}

/**
 * Discover other nodes with the given attributes
 * This function need only store the attributes on the node. The LocalRegistry will
 * look for other nodes with these attributes the next time it scans local storage.
 */
LocalRegistry.prototype.discoverAttributes = function(dattrs) {
    for (var key in dattrs.device) {
        this.attrsToDiscover.device[key] = dattrs.device[key];
    }

    for (var key in dattrs.fog) {
        this.attrsToDiscover.fog[key] = dattrs.fog[key];
    }

    for (var key in dattrs.cloud) {
        this.attrsToDiscover.cloud[key] = dattrs.cloud[key];
    }
}

/**
 * Stops discovering the specified attributes
 */
LocalRegistry.prototype.stopDiscoveringAttributes = function(dattrs) {
    if (dattrs.device) {
        for (var i = 0; i < dattrs.device.length; i++) {
            delete this.attrsToDiscover.device[dattrs.device[i]];
        }
    }

    if (dattrs.fog) {
        for (var i = 0; i < dattrs.fog.length; i++) {
            delete this.attrsToDiscover.fog[dattrs.fog[i]];
        }
    }

    if (dattrs.cloud) {
        for (var i = 0; i < dattrs.cloud.length; i++) {
            delete this.attrsToDiscover.cloud[dattrs.cloud[i]];
        }
    }
}

//==============================================================================
// Helpers
//==============================================================================

LocalRegistry.prototype._getBinName = function() {
    var binNumber = this._hash(this.id);
    if (this.machType === constants.globals.NodeType.FOG) {
        return 'fogs_' + binNumber;
    } else if (this.machType === constants.globals.NodeType.CLOUD) {
        return 'clouds_' + binNumber;
    } else {
        return 'devices_' + binNumber;
    }
}

/**
 * Hash a uuid into an integer in the range 0 to constants.localStorage.numBins-1
 */
LocalRegistry.prototype._hash = function(uuid) {
    var hash = 0, i, chr;
    if (uuid.length === 0) return hash;
    for (i = 0; i < uuid.length; i++) {
        chr = uuid.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0; // convert to a 32 bit integer
    }
    if (hash < 0) {
        hash += 1;
        hash *= -1;
    }
    return hash % constants.localStorage.numBins;
}

/**
 * Helper for computing wait time
 */
LocalRegistry.prototype._getWaitTime = function(attemptNumber) {
    return Math.ceil(Math.random() * Math.pow(2, attemptNumber));
}

module.exports = LocalRegistry;
