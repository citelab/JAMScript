const RecordType = Object.freeze({
    START: 'START',
    RESTART: 'RESTART',
    DONE: 'DONE',
});

class LogRecord {

    static createStart(contextId, primaryFog, secondaryFog) {
        return {
            type: RecordType.START,
            contextId: contextId,
            primaryFog: primaryFog,
            secondaryFog: secondaryFog,
        };
    }

    static createRestart(contextId, primaryFog, secondaryFog) {
        return {
            type: RecordType.RESTART,
            contextId: contextId,
            primaryFog: primaryFog,
            secondaryFog: secondaryFog,
        };
    }

    static createDone(contextId, primaryFog, secondaryFog, result, error) {
        return {
            type: RecordType.DONE,
            contextId: contextId,
            primaryFog: primaryFog,
            secondaryFog: secondaryFog,
            result: result,
            error: error,
        };
    }

    static toString(record) {
        return `type=${record.type}`
            + `, contextId=${record.contextId}`
            + (record.primaryFog ? `, primaryFog=${record.primaryFog.substring(0, 8)}` : '')
            + (record.secondaryFog ? `, secondaryFog=${record.secondaryFog.substring(0, 8)}` : '')
            + (record.result ? `, result=${record.result}` : '')
            + (record.error ? `, error=${record.error}` : '');
    }

}

exports.RecordType = RecordType;
exports.LogRecord = LogRecord;
