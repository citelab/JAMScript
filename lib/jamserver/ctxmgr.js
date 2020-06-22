const cbor = require('cbor');
const deasync = require('deasync');
const util = require('util');
const ContextLog = require('./ctxlog');
const {RecordType, LogRecord} = require('./logrecord');
const logger = require('./logger');

class ContextManager {

    constructor(fogId, app, zone, host, port) {
        this.fogId = fogId;
        this.app = app;
        this.zone = zone;
        this.contextLog = new ContextLog(app, zone, host, port);
        this.readIndex = 0;
        this.contexts = new Map();
        this.contextId = 0;
        this.lastReadContextId = 0;
        this.primaryFog = null;
        this.secondaryFog = null;
        this.activeFogs = new Set([fogId]);
        this.broker = null;
        this._processLogRecordsSync = deasync(util.callbackify(this.processLogRecords).bind(this));
    }

    initialize() {
        this.contextLog.initialize();
        this.processLogRecordsSync();
        this.writeInitialStartRecord(0, this.fogId);
        this.processLogRecords();
        setTimeout(() => this.checkZone(), 5000);
    }

    async readLogRecord(wait = true) {
        const record = await this.contextLog.get(this.readIndex, wait);
        if (record != null) {
            logger.debug(__filename, 'main', `readLogRecord(${this.readIndex}): ${LogRecord.toString(record)}`);
            this.readIndex++;
        }
        return record;
    }

    async writeLogRecord(record) {
        let writeIndex = this.readIndex;
        let success = false;
        while (true) {
            success = await this.contextLog.set(writeIndex, record);
            if (success) {
                logger.debug(__filename, 'main', `writeLogRecord(${writeIndex}): ${LogRecord.toString(record)}`);
                break;
            }
            writeIndex++;
        }
        return success;
    }

    async writeInitialLogRecord(record) {
        const success = await this.contextLog.set(0, record);
        if (success) {
            logger.debug(__filename, 'main', `writeInitialLogRecord(): ${LogRecord.toString(record)}`);
        }
        return success;
    }

    async processLogRecords(wait = true) {
        while (true) {
            const record = await this.readLogRecord(wait);
            if (record == null) {
                break;
            }
            this.processLogRecord(record);
        }
    }

    processLogRecordsSync() {
        this._processLogRecordsSync(false);
        logger.debug(__filename, 'main', `Context manager initialized on fog ${this.fogId}`);
    }

    processLogRecord(record) {
        if (this.primaryFog !== record.primaryFog || this.secondaryFog !== record.secondaryFog) {
            this.primaryFog = record.primaryFog;
            this.secondaryFog = record.secondaryFog;

            if (this.fogId === this.primaryFog) {
                logger.info(__filename, 'main', 'Fog selected as primary');
            } else if (this.fogId === this.secondaryFog) {
                logger.info(__filename, 'main', 'Fog selected as secondary');
            }

            this.sendDeviceNotification();
        }

        if (this.lastReadContextId < record.contextId) {
            this.lastReadContextId = record.contextId;
        }

        let context = this.getContext(this.lastReadContextId);
        switch (record.type) {
            case RecordType.START:
                context.executor = record.primaryFog;
                context.start.resolve();
                context.start.fulfilled = true;
                break;
            case RecordType.RESTART:
                if (context.running) {
                    context.done.reject('context-restart');
                }
                this.clearContext(this.lastReadContextId);
                context = this.getContext(this.lastReadContextId);
                context.executor = record.primaryFog;
                context.reexec = true;
                break;
            case RecordType.DONE:
                if (record.error != null) {
                    context.done.reject(record.error);
                } else {
                    context.done.resolve(record.result);
                }
                context.done.fulfilled = true;
                break;
        }
    }

    getContextId() {
        return this.contextId;
    }

    setContextId(contextId) {
        this.contextId = contextId;
    }

    getContext(contextId) {
        let context = this.contexts.get(contextId);
        if (context == null) {
            const start = this.createContextPromise();
            const done = this.createContextPromise();
            const running = false;
            const reexec = false;
            context = {start, done, running, reexec};
            this.contexts.set(contextId, context);
        }
        return context;
    }

    createContextPromise() {
        let res, rej;
        const promise = new Promise((resolve, reject) => {
            res = resolve;
            rej = reject;
        });
        promise.resolve = res;
        promise.reject = rej;
        promise.fulfilled = false;
        promise.catch(() => {});
        return promise;
    }

    clearContext(contextId) {
        this.contexts.delete(contextId);
    }

    fogUp(id, info) {
        if (this.fogId !== id && !this.activeFogs.has(id)) {
            logger.debug(__filename, 'main', 'Fog up:', id);

            this.activeFogs.add(id);
            logger.debug(__filename, 'main', 'Active fogs:', this.activeFogs);

            if (this.fogId === this.primaryFog && this.secondaryFog == null) {
                const contextId = this.contextId;
                const context = this.getContext(contextId);
                if (!context.running) {
                    const primaryFog = this.fogId;
                    const secondaryFog = this.selectFog(primaryFog);
                    this.writeRestartRecord(this.contextId, primaryFog, secondaryFog);
                    this.copyData(contextId - 1, secondaryFog).then(() => this.writeStartRecord(contextId, primaryFog, secondaryFog));
                }
            }
        }
    }

    fogDown(id) {
        if (this.fogId !== id && this.activeFogs.has(id)) {
            logger.debug(__filename, 'main', 'Fog down:', id);

            this.activeFogs.delete(id);
            logger.debug(__filename, 'main', 'Active fogs:', this.activeFogs);

            if (this.fogId === this.primaryFog) {
                if (id === this.secondaryFog) {
                    // primary fog detects that secondary fog is down
                    const contextId = this.contextId;
                    const context = this.getContext(contextId);
                    if (!context.running) {
                        const primaryFog = this.fogId;
                        const secondaryFog = this.selectFog(primaryFog);
                        this.writeRestartRecord(contextId, primaryFog, secondaryFog);
                        this.copyData(contextId - 1, secondaryFog).then(() => this.writeStartRecord(contextId, primaryFog, secondaryFog));
                    }
                }
            } else if (this.fogId === this.secondaryFog) {
                if (id === this.primaryFog) {
                    // secondary fog detects that primary fog is down
                    const contextId = this.contextId;
                    const primaryFog = this.fogId;
                    const secondaryFog = this.selectFog(primaryFog);
                    this.writeRestartRecord(contextId, primaryFog, secondaryFog);
                    this.copyData(contextId - 1, secondaryFog).then(() => this.writeStartRecord(contextId, primaryFog, secondaryFog));
                }
            }
        }
    }

    selectFog(...excludedIds) {
        const fogs = [...this.activeFogs].filter(id => !excludedIds.includes(id));
        return fogs[Math.floor(Math.random() * fogs.length)];
    }

    selectFogs() {
        const primaryFog = this.primaryFog;
        const secondaryFog = this.activeFogs.has(this.secondaryFog) ? this.secondaryFog : this.selectFog(primaryFog);
        return {primaryFog, secondaryFog};
    }

    writeDone(contextId, result, error) {
        if (this.fogId === this.primaryFog) {
            const {primaryFog, secondaryFog} = this.selectFogs();
            this.writeDoneRecord(contextId, primaryFog, secondaryFog, result, error);
            this.writeStartRecord(contextId + 1, primaryFog, secondaryFog);
        }
    }

    checkZone() {
        if (!this.activeFogs.has(this.primaryFog) && this.secondaryFog == null) {
            const primaryFog = this.fogId;
            const secondaryFog = this.selectFog(primaryFog);
            this.writeRestartRecord(this.contextId, primaryFog, secondaryFog);
        }
    }

    writeInitialStartRecord(contextId, primaryFog, secondaryFog) {
        const record = LogRecord.createStart(contextId, primaryFog, secondaryFog);
        this.writeInitialLogRecord(record);
    }

    writeStartRecord(contextId, primaryFog, secondaryFog) {
        const record = LogRecord.createStart(contextId, primaryFog, secondaryFog);
        this.writeLogRecord(record);
    }

    writeRestartRecord(contextId, primaryFog, secondaryFog) {
        const record = LogRecord.createRestart(contextId, primaryFog, secondaryFog);
        this.writeLogRecord(record);
    }

    writeDoneRecord(contextId, primaryFog, secondaryFog, result, error) {
        const record = LogRecord.createDone(contextId, primaryFog, secondaryFog, result, error);
        this.writeLogRecord(record);
    }

    sendDeviceNotification() {
        const topic = `/${this.app}/${this.zone}/zoneconf`;
        const msg = cbor.encode({
            cmd: 'ZONE-CONF',
            sender: this.fogId,
            seqNum: this.readIndex - 1,
            primaryFog: this.primaryFog,
            secondaryFog: this.secondaryFog,
        });
        const opts = {
            retain: true,
        };
        if (this.broker != null) {
            this.broker.publish(topic, msg, opts);
        } else {
            setTimeout(() => this.sendDeviceNotification(), 3000);
        }
    }

    async copyData(contextId, targetFog) {
        if (this.fogId !== targetFog) {
            // copy data for contextId to targetFog
            // comment for perf test
            await this.sleep(2000); // milliseconds
        }
    }

    async sleep(millis) {
        return new Promise(resolve => setTimeout(resolve, millis));
    }

}

module.exports = ContextManager;
