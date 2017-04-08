jdata {
    int x as logger;
    int y as broadcaster;
}

setInterval(function() {
    var delim = '--------------------------------------------';
    console.log('\n\n\n' + delim);
    console.log('Datasource x');
    console.log(delim);

    console.log(' ');
    console.log('• Property: type');
    console.log('x.type: ' + x.type);

    console.log(' ');
    console.log('• Method: size()');
    console.log('x.size(): ' + x.size());

    var dsIdx = -1;
    while (true) {
        dsIdx++;
        if (x[dsIdx] == undefined) {
            break;
        }
        console.log('\n\n' + delim);
        console.log('Datastream ' + dsIdx + ' of datasource x');
        console.log(delim);

        console.log(' ');
        console.log('• Property: dev_id');
        console.log('x[' + dsIdx + '].dev_id: ' + x[dsIdx].dev_id);

        console.log(' ');
        console.log('• Property: description');
        console.log('x[' + dsIdx + '].description: ' + x[dsIdx].description);

        console.log(' ');
        console.log('• Method: size()');
        console.log('x[' + dsIdx + '].size(): ' + x[dsIdx].size());

        console.log(' ');
        console.log('• Method: isEmpty()');
        console.log('x[' + dsIdx + '].isEmpty(): ' + x[dsIdx].isEmpty());

        console.log(' ');
        console.log('• Method: lastData()');
        var d = x[dsIdx].lastData();
        if (d) {
            console.log('x[' + dsIdx + '].lastData().value: ' + x[dsIdx].lastData().value);
            console.log('x[' + dsIdx + '].lastData().timestamp: ' + x[dsIdx].lastData().timestamp);
        } else {
            console.log('x[' + dsIdx + '].lastData(): null');
        }

        console.log(' ');
        console.log('• Method: lastValue()');
        console.log('x[' + dsIdx + '].lastValue(): ' + x[dsIdx].lastValue());

        console.log(' ');
        console.log('• Method: data()');
        var data = x[dsIdx].data();
        var length = data.length;
        console.log('x[' + dsIdx + '].data().length: ' + length);
        var len = Math.min(length, 3);
        for (var i = 0; i < len; i++) {
            console.log('x[' + dsIdx + '].data()[' + i + '].value: ' + data[i].value);
            console.log('x[' + dsIdx + '].data()[' + i + '].timestamp: ' + data[i].timestamp);
        }
        if (length > len) {
            console.log('more...');
        }

        console.log(' ');
        console.log('• Method: values()');
        var values = x[dsIdx].values();
        var length = values.length;
        console.log('x[' + dsIdx + '].values().length: ' + length);
        var len = Math.min(length, 3);
        for (var i = 0; i < len; i++) {
            console.log('x[' + dsIdx + '].values()[' + i + ']: ' + values[i]);
        }
        if (length > len) {
            console.log('more...');
        }

        console.log(' ');
        console.log('• Method: n_data(N)');
        var N = 4;
        console.log('  N = ' + N);
        var n_data = x[dsIdx].n_data(N);
        var length = n_data.length;
        console.log('x[' + dsIdx + '].n_data(' + N + ').length: ' + length);
        for (var i = 0; i < length; i++) {
            console.log('x[' + dsIdx + '].n_data(' + N + ')[' + i + '].value: ' + n_data[i].value);
            console.log('x[' + dsIdx + '].n_data(' + N + ')[' + i + '].timestamp: ' + n_data[i].timestamp);
        }

        console.log(' ');
        console.log('• Method: n_values(N)');
        var N = 4;
        console.log('  N = ' + N);
        var n_values = x[dsIdx].n_values(N);
        var length = n_values.length;
        console.log('x[' + dsIdx + '].n_values(' + N + ').length: ' + length);
        for (var i = 0; i < length; i++) {
            console.log('x[' + dsIdx + '].n_values(' + N + ')[' + i + ']: ' + n_values[i]);
        }

        console.log(' ');
        console.log('• Method: dataAfter(timestamp)');
        var timestamp = new Date();
        timestamp.setSeconds(timestamp.getSeconds() - 10);
        console.log('  timestamp = ' + timestamp);
        var dataAfter = x[dsIdx].dataAfter(timestamp);
        var length = dataAfter.length;
        console.log('x[' + dsIdx + '].dataAfter(timestamp).length: ' + length);
        var len = Math.min(length, 3);
        for (var i = 0; i < len; i++) {
            console.log('x[' + dsIdx + '].dataAfter(timestamp)[' + i + '].value: ' + dataAfter[i].value);
            console.log('x[' + dsIdx + '].dataAfter(timestamp)[' + i + '].timestamp: ' + dataAfter[i].timestamp);
        }
        if (length > len) {
            console.log('more...');
        }

        console.log(' ');
        console.log('• Method: valuesAfter(timestamp)');
        var timestamp = new Date();
        timestamp.setSeconds(timestamp.getSeconds() - 5);
        console.log('  timestamp = ' + timestamp);
        var valuesAfter = x[dsIdx].valuesAfter(timestamp);
        var length = valuesAfter.length;
        console.log('x[' + dsIdx + '].valuesAfter(timestamp).length: ' + length);
        var len = Math.min(length, 3);
        for (var i = 0; i < len; i++) {
            console.log('x[' + dsIdx + '].valuesAfter(timestamp)[' + i + ']: ' + valuesAfter[i]);
        }
        if (length > len) {
            console.log('more...');
        }

        console.log(' ');
        console.log('• Method: dataBetween(fromTimestamp, toTimestamp)');
        var fromTimestamp = new Date();
        fromTimestamp.setSeconds(fromTimestamp.getSeconds() - 10);
        console.log('  fromTimestamp = ' + fromTimestamp);
        var toTimestamp = new Date();
        toTimestamp.setSeconds(toTimestamp.getSeconds() - 5);
        console.log('  toTimestamp = ' + toTimestamp);
        var dataBetween = x[dsIdx].dataBetween(fromTimestamp, toTimestamp);
        var length = dataBetween.length;
        console.log('x[' + dsIdx + '].dataBetween(fromTimestamp, toTimestamp).length: ' + length);
        var len = Math.min(length, 3);
        for (var i = 0; i < len; i++) {
            console.log('x[' + dsIdx + '].dataBetween(fromTimestamp, toTimestamp)[' + i + '].value: ' + dataBetween[i].value);
            console.log('x[' + dsIdx + '].dataBetween(fromTimestamp, toTimestamp)[' + i + '].timestamp: ' + dataBetween[i].timestamp);
        }
        if (length > len) {
            console.log('more...');
        }

        console.log(' ');
        console.log('• Method: valuesBetween(fromTimestamp, toTimestamp)');
        var fromTimestamp = new Date();
        fromTimestamp.setSeconds(fromTimestamp.getSeconds() - 10);
        console.log('  fromTimestamp = ' + fromTimestamp);
        var toTimestamp = new Date();
        toTimestamp.setSeconds(toTimestamp.getSeconds() - 5);
        console.log('  toTimestamp = ' + toTimestamp);
        var valuesBetween = x[dsIdx].valuesBetween(fromTimestamp, toTimestamp);
        var length = valuesBetween.length;
        console.log('x[' + dsIdx + '].valuesBetween(fromTimestamp, toTimestamp).length: ' + length);
        var len = Math.min(length, 3);
        for (var i = 0; i < len; i++) {
            console.log('x[' + dsIdx + '].valuesBetween(fromTimestamp, toTimestamp)[' + i + ']: ' + valuesBetween[i]);
        }
        if (length > len) {
            console.log('more...');
        }
    }

    console.log('\n\n' + delim);
    var val = Math.floor((Math.random() * 100) + 1);
    console.log('Broadcaster y');
    console.log(delim);
    console.log('JAMManager.broadcastMessage(\'y\', ' + val + ')');
    y = val;
}, 3000);
