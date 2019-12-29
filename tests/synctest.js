var count = 1;

jsync function getId() {
    console.log("Creating an ID.. ", count+1);
    return count++;
}
