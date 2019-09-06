const tf = require('@tensorflow/tfjs-node');

function makeIterator() {
  const numElements = 10;
  let index = 0;

  const iterator = {
    next: () => {
      let result;
      if (index < numElements) {
        result = {value: index, done: false};
        index++;
        return result;
      }
      return {value: index, done: true};
    }
  };
  return iterator;
}
const ds = tf.data.generator(makeIterator);
ds.forEachAsync(e => console.log(e));
