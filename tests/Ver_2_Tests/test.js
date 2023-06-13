let a = new Map()
a.set(1, "test")
a.set(2, "world")
a.set(3, "hello")

let y = a.values();
while((x = y.next()) && x.done === false)
	console.log(x.value)

