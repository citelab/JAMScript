---
layout: page
title: Basics
subtitle: Writing a JAMScript program
---


A JAMScript program is comprised of two halfs: The C side and the JavaScript side.

## C

### Calling a JavaScript function

If you have any functions that you would to be run on a JavaScript node, create a function prototype as you would for any other C function, specifying the parameters that it takes and its return type. You can then make the functions calls anywhere in your C program that you would a regular function call.


### Making a function available to JavaScript

Create the function as you would for a regular C function, but place the keyword jsync before the function's return type. If you would like to create an asyncronous function call, use the keyword jasync before the function name, leaving out the return type.



## JavaScript

### Calling a C function

If you have any functions that you would to be run on a C node you do not need to place any extra code on the JavaScript side, just call the function as you would any other function.


### Making a function available to C

Create the function as you would for a regular JavaScript function, but place the keyword jsync or jasync infront the function declaration. This turns the function into an activity that is visible to the C side.

