
class StringMessage {

  #minLength;
  #maxLength;
  #size;
  #stringArray;
  static letters = "abcdefghijklmnopqrstuvwxyz";

  constructor({size, minLength, maxLength}) {
    this.#minLength = minLength;
    this.#maxLength = maxLength;
    this.#size = size;
    this.#stringArray = this.randomStringArray();
  }

  static randomLetter = () => {
    const randomIndex = Math.floor(Math.random() * StringMessage.letters.length);
    return StringMessage.letters[randomIndex];
  }
  static randomNumber(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  randomLength = () => {
    return StringMessage.randomNumber(this.#minLength, this.#maxLength);
  }

  randomString = () => {
    let randomString = "";
    for (let i = 0; i < this.randomLength(); i++) {
      const number = StringMessage.randomNumber(0, 9);
      if (number % 2 === 0) {
        randomString += StringMessage.randomLetter();
      } else {
        randomString += number.toString();
      }
    }

    return randomString;
  }
  randomStringArray = () => {
    const randomArray = [];
    for (let i = 0; i < this.#size; i++) {
      randomArray.push(this.randomString())
    }
    return randomArray;
  };
  updateArray = () => {
    const randomIndex = Math.floor(Math.random() * this.stringArray.length);
    const newArray = [...this.stringArray];
    newArray[randomIndex] = this.randomString();
    this.stringArray = newArray;
  };

  get stringArray() {
    return this.#stringArray;
  }

  set stringArray(newArray) {
    this.#stringArray = newArray;
  }
  
}

module.exports = StringMessage;
