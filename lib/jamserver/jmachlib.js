// jmachlib.js
const ebus = require('jamserver/ebus');
const tf = require('@tensorflow/tfjs-node');
const fastcsv = require('fast-csv');
const fs = require('fs')

var jsys;
var cmdopts;

module.exports = new function() {
  this.run = run;
  this.getjsys = getjsys;
  this.getcmdopts = getcmdopts;
  this.loop = loop;
}

function setupMachlib() {

  fs.mkdir('model', (err) => {
    if (err) {
      return console.error("model folder has already exist");
    }
    console.log('Directory created successfully!');
  });

  fs.mkdir('modelFog', (err) => {
    if (err) {
      return console.error("modelFog foler has already exist");
    }
    console.log('Directory created successfully!');
  });

  fs.mkdir('modelFog/nodePredictor', (err) => {
    if (err) {
      return console.error("modelFog/nodePredictor foler has already exist");
    }
    console.log('Directory created successfully!');
  });
}

function getjsys() {
  return jsys;
}

function getcmdopts() {
  return cmdopts;
}

async function loop(jman, jbcast, jlog) {

  var jlogger = jlog.getMyDataStream();

  if (jsys.type === "cloud") {
    let cloudData = [];
    console.log("-----------------cloud------------------");
    //read data from devices
    setInterval(function() {
      let ws0;
      for (i = 0; i < jlog.size(); i++) {
        if (jlog[i] !== undefined) {
          //TODO: bug 2, jlog[i].lastData() can only read the newest datapoint,
          //this may cause miss or double read data points, same issue in fog part
          let nextBatch = jlog[i].lastData();
          if (nextBatch !== null) {
            nextBatch = (nextBatch["value"]["nextBatch"]);

            //save dataset into local variable
            cloudData.push.apply(cloudData, nextBatch);
            console.log(cloudData.length);
          }
        }
      }
    }, 2000);

    //process, train and save model
    setInterval(async function() {
      if (cloudData.length > 100 && cloudData.length < 250) {
        console.log("cloud ML training invoked");
        //train the model
        await cloud(cloudData);
        // broadcast to fog nodes
        if (fs.existsSync("model/nodePredictor/model.json")) {
          let modelText = fs.readFileSync('model/nodePredictor/model.json', 'utf8')
          jbcast.broadcast(JSON.stringify({"model": modelText}));
          console.log('Publishing model.json... ');
        }

        if (fs.existsSync("model/nodePredictor/weights.bin")) {
          let binary = fs.readFileSync('model/nodePredictor/weights.bin');
          let b64 = binary.toString('base64');
          //TODO: bug 3, When broadcasting a json object, such as {key:value}, fog side jbcast.addHook getting called twice.
          //for example, uncomment jbcast.broadcast(b64); "jbcast.addHook getting called" will only print once
          //and compare with the original json version, which will be print twice

          //jbcast.broadcast(b64);
          jbcast.broadcast({"weights": b64});
          console.log('Publishing weights.bin... ');
        }
      }
    }, 3000);


  } else if (jsys.type === "fog") {
    let fogData = [];
    let weightsUpdated = false;
    let modelUpdated = false;
    console.log("----------------fog------------------");

    jbcast.addHook(function(x) {
      console.log("jbcast.addHook getting called");
      if (x["message"]["weights"] != undefined) {
        binary = new Buffer.from(x["message"]["weights"].toString(), 'base64');
        try {
          let ws = fs.createWriteStream("modelFog/nodePredictor/weights.bin");
          ws.write(binary);
          ws.end();
          weightsUpdated = true;
          console.log("Received weights.bin... ");
        } catch (err) {
          console.error(err)
        }
      }
      else if (x["message"]["model"] != undefined) {
        try {
          let ws = fs.createWriteStream("modelFog/nodePredictor/model.json");
          ws.write(x["message"]["model"]);
          ws.end();
          modelUpdated = true;
          console.log("Received model.json... ");
        } catch (err) {
          console.error(err)
        }
      }
    })

    setInterval(function() {
      let ws0;
      for (i = 0; i < jlog.size(); i++) {
        if (jlog[i] !== undefined) {
          //TODO: bug 2, jlog[i].lastData() can only read the newest datapoint,
          //this may cause miss or double read data points, same issue in cloud part
          let nextBatch = jlog[i].lastData();
          if (nextBatch !== null) {
            nextBatch = (nextBatch["value"]["nextBatch"]);

            //save dataset into local variable
            fogData.push.apply(fogData, nextBatch);
            console.log(fogData.length);
          }
        }
      }
    }, 2000);

    //process, load and train model
    setInterval(function() {
      if (modelUpdated && weightsUpdated) {
        modelUpdated = false;
        weightsUpdated = false;
        fog(fogData);
      }
    }, 4000);


    //TODO: use old model for prediction


  } else {
    console.log("---------------device-------------------");

    /*TODO: bug 1
    @ deviceBatch: the max size of deviceBatch can only be 50, try 100 and you
    will see the error message  */

    //initialize device variable
    let deviceData;
    let deviceBatch = 50;
    let deviceCurrent = 0;

    if (deviceData == undefined) {
      console.log('Current directory: ' + process.cwd());
      deviceData = await getData("file://data/last_impl_datset.csv");
    }

    setInterval(function() {
      if (deviceCurrent < deviceData.length) {
        let nextBatch = deviceData.slice(deviceCurrent, deviceCurrent + deviceBatch);
        deviceCurrent += deviceBatch;
        nextBatch = {
          "nextBatch": nextBatch
        };
        jlogger.log(JSON.stringify(nextBatch));
      }
    }, 2000);
  }

}

function run(callback) {

  onmessage = function(ev) {
    var v = ev.data;
    switch (v.cmd) {
      case 'NCACHE-MOD':
        switch (v.opt) {
          case 'FOG-DATA-UP':
            ebus.fogDataUp(v.data);
            break;
          case 'FOG-DATA-DOWN':
            ebus.fogDataDown();
            break;

          case 'CLOUD-DATA-UP':
            ebus.cloudDataUp(v.data);
            break;

          case 'CLOUD-DATA-DOWN':
            ebus.cloudDataDown();
            break;
        }
        postMessage({
          cmd: 'DONE'
        });
        break;
      case 'CONF-DATA':
        switch (v.opt) {
          case 'CMDOPTS':
            cmdopts = v.data;
            break;
          case 'JSYS':
            jsys = v.data;
            setupMachlib();
            // This is running the actual machine learner module
            if (callback !== undefined)
              callback();
            break;
        }
        postMessage({
          cmd: 'DONE'
        });
      default:
    }
  }
}

async function cloud(data) {

  //load data
  //const data = await getData("file://data/cloud.csv");

  //parse data
  let {
    processedData,
    nodeArray //nodeArray = ['Fog node_8.0', 'Fog node_9.0' ...]
  } = parseData(data);

  //split tran and test set
  let {
    train,
    test
  } = trainTest(processedData);

  //convert to tensor
  let {
    input,
    label
  } = convertToTensor(train, nodeArray);

  //create model
  let model = createModel(nodeArray.length);

  //training model and save model
  await trainModel(model, input, label, 250);
  await model.save("file://model/nodePredictor");

  //test model accuracy
  nodeArray.sort();
  temp = convertToTensor(test, nodeArray);
  input = temp.input;
  label = temp.label;
  testModelT(model, input, label);
}


async function fog(data) {

  //parse data
  let {
    processedData,
    nodeArray //nodeArray = ['Fog node_8.0', 'Fog node_9.0' ...]
  } = parseData(data);

  //split train and test set
  let {
    train,
    test
  } = trainTest(processedData);

  //convert to tensor
  let {
    input,
    label
  } = convertToTensor(train, nodeArray);

  //load model
  baseModel = await tf.loadLayersModel("file://modelFog/nodePredictor/model.json");
  let model = createTransferModelFromBaseModel(baseModel, nodeArray.length);
  await trainModel(model, input, label, 250);

  //test
  nodeArray.sort();
  temp = convertToTensor(test, nodeArray);
  input = temp.input;
  label = temp.label;
  testModelT(model, input, label);
}


async function getData(path) {
  const data = tf.data.csv(path);
  d = await data.toArray();
  //s = await (data.take(10000)).toArray()
  return d;
}

function parseData(dataArray) {
  let nodeSet = new Set();
  dataArray.map(d => {
    if (d['Fog node'] === undefined) {
      nodeSet.add('Nil');
    } else {
      nodeSet.add(d['Fog node']);
    }
  })
  nodeArray = Array.from(nodeSet).sort();

  //one hot vector
  halfProcessedData = dataArray.map(d => {
    nodeArray.forEach(n => {
      if (d['Fog node'] === undefined) {
        d['Nil'] = 1
      } else if (d['Fog node'] == n) {
        name = 'Fog node_' + String(n);
        d[name] = 1
      } else {
        name = 'Fog node_' + String(n);
        d[name] = 0
      }
    })
    return d
  })
  nodeArray = nodeArray.map(d => 'Fog node_' + String(d));

  //get rid of unneeded features
  //ignore data row with NaN inside
  const processedData = halfProcessedData.filter(function(d) {
    if (isNaN(d['xcell']) || isNaN(d['ycell']) || isNaN(d['x_cart']) ||
      isNaN(d['y_cart']) || isNaN(d['z_cart']) || isNaN(d['Day']) ||
      isNaN(d['sin_time']) || isNaN(d['cos_time']) || isNaN(d['Cost'])) {
      return false;
    }
    return true;
  }).map(function(d) {
    let temp = {};
    let a = nodeArray.map(f => (temp[f] = d[f]));
    // temp['xcell'] = d['xcell'];
    // temp['ycell'] = d['ycell'];
    temp['x_cart'] = d['x_cart'];
    temp['y_cart'] = d['y_cart'];
    temp['z_cart'] = d['z_cart']
    // temp['Day'] = d['Day'];
    temp['sin_time'] = d['sin_time'];
    temp['cos_time'] = d['cos_time'];
    temp['Cost'] = d['Cost'];
    return temp;
  })
  return {
    processedData: processedData,
    nodeArray: nodeArray
  };
}

function featureLabel(dataArray, nodeArray) {
  let features = dataArray.map(function(d) {
    let temp = [];
    // temp = temp.concat(d['xcell']);
    // temp = temp.concat(d['ycell']);
    temp = temp.concat(d['x_cart']);
    temp = temp.concat(d['y_cart']);
    temp = temp.concat(d['z_cart']);
    // temp = temp.concat(d['Day']);
    temp = temp.concat(d['sin_time']);
    temp = temp.concat(d['cos_time']);
    return temp;
  })

  let labels = dataArray.map(function(d) {
    let temp = [];
    nodeArray.map(f => (temp = temp.concat(d[f])));
    return temp;
  })
  return {
    features: features,
    labels: labels
  };
}

function createModel(outputs) {
  const model = tf.sequential();
  model.add(tf.layers.dense({
    inputShape: [5],
    units: 350,
    activation: 'sigmoid',
    useBias: true
  }));
  model.add(tf.layers.dense({
    units: 350,
    activation: 'sigmoid',
    useBias: true
  }));
  model.add(tf.layers.dense({
    units: 350,
    activation: 'sigmoid',
    useBias: true
  }));
  model.add(tf.layers.dense({
    units: outputs,
    activation: 'sigmoid',
    useBias: true
  }));
  return model;
}

//random shuffle
function shuffle(a) {
  var j, x, i;
  for (i = a.length - 1; i > 0; i--) {
    j = Math.floor(Math.random() * (i + 1));
    x = a[i];
    a[i] = a[j];
    a[j] = x;
  }
  return a;
}

//split train test by 80%, 20%
function trainTest(data) {
  let shuffledData = shuffle(data);
  let l = Math.ceil(0.8 * shuffledData.length);
  return {
    train: shuffledData.slice(0, l),
    test: shuffledData.slice(l)
  }
}

function convertToTensor(data, nodeArray) {
  return tf.tidy(() => {
    tf.util.shuffle(data);

    let fl = featureLabel(data, nodeArray);

    const inputs = fl.features;
    const labels = fl.labels;

    const inputTensor = tf.tensor2d(inputs, [inputs.length, inputs[0].length]);
    const labelTensor = tf.tensor2d(labels, [labels.length, labels[0].length]);

    return {
      input: inputTensor,
      label: labelTensor
    }
  })
}

async function trainModel(model, inputs, labels, epoch) {
  model.compile({
    optimizer: tf.train.adam(),
    loss: tf.losses.meanSquaredError,
    metrics: ['mse'],
    // loss: 'categoricalCrossentropy',
    // metrics: ['categoricalCrossentropy'],
  });

  const batchSize = 4098;
  const epochs = epoch;

  return await model.fit(inputs, labels, {
    batchSize,
    epochs,
    shuffle: true
  });
}

async function testModelT(model, inputs, labels) {

  // inputs.print();
  let prediction = model.predict(inputs);
  // prediction.print();
  const axis = 1;
  let p = prediction.argMax(axis);
  p = await p.dataSync();
  let l = labels.argMax(axis);
  l = await l.dataSync();

  count = 0;
  for (var i = 0; i < l.length; i++) {
    if (p[i] == l[i]) {
      count++;
    }
  }
  console.log("model accuracy:" + count / l.length);
}

function createTransferModelFromBaseModel(baseModel, outputs) { //outputs: number of outputs(fogs)
  const layers = baseModel.layers;
  let layerIndex = layers.length - 2;
  if (layerIndex < 0) {
    throw new Error('Cannot find a hidden dense layer in the base model.')
  }
  for (let i = 0; i < layerIndex; i++) {
    layers[i].trainable = false;
  }
  let secondLastBaseDenseLayer = layers[layerIndex];
  const truncatedBaseOutput = layers[layerIndex].output;

  this.transferHead = tf.layers.dense({
    units: outputs,
    activation: 'softmax', //'softmax',
    inputShape: truncatedBaseOutput.shape.slice(1),
    name: layers[layerIndex + 1].name
  });
  const transferOutput = this.transferHead.apply(truncatedBaseOutput);

  let model = tf.model({
    inputs: baseModel.inputs,
    outputs: transferOutput
  });
  model.summary()
  return model;
}

