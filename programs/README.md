To run the test suite for compiler, run the command `bash path/to/testCompiler.sh`

The test suite folder has the following structure:
```
├── c
│   ├── invalid
│   │   └── scanning+parsing
│   │       ├── 1-identifier
│   │       ├── 2-comment
│   │       ├── 3-declaration
│   │       ├── 4-string
│   │       ├── 5-gccRelated
│   │       └── 6-statement
│   └── valid
├── jamc
│   └── invalid
│       ├── scanning+parsing
│       │   ├── 1-JAMCActivity
│       │   └── 2-JAMCCond
│       └── symbol+typecheck
├── jamjs
│   ├── invalid
│   └── valid
└── js
    ├── invalid
    └── valid
```

`programs/c` contains test cases written in pure C. <br>
`programs/jamc` contains test cases written in C with JAMScript addition. <br>
`programs/jamjs` contains test cases written in JavaScript with JAMScript addition. <br>
`programs/js` contains test cases written in pure JavaScript. <br>

If a test case is expected to fail compilation, it should be placed in the `invalid` subdirectory. <br>
If a test case is expected to pass compilation, it should be placed in the `valid` subdirectory. <br>

e.g. A valid program written in C with JAMScript addition should be placed in `programs/jamc/valid`.

Note that the placement of the test cases must follow the rules above for the test script `testCompiler.sh` to work properly.
