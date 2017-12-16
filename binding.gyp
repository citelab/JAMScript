{
  "make_global_settings": [
    ["CC", "/usr/bin/clang"],
    ["LINK", "/usr/bin/clang"]
  ],
  "targets": [
    {
      "target_name": "test",
      "type": "executable",
      "sources": [
        "lib/jamlib/tests/cachetest.c",
        "lib/jamlib/simplelist.c",
        "lib/jamlib/nvoid.c"
      ],
      'link_settings': {
        "libraries": [
          '-lm',
          '-lbsd',
          '-lpthread',
          '-lcbor',
          '-lnanomsg',
          '-levent',
          '-ltask',
          '-lmujs',
          '-lhiredis'
        ],
        "conditions": [
          ["OS == 'mac'",  {
            "libraries!": [
              '-lm',
              '-lbsd',
              '-lpthread',
              '-lcbor',
              '-lnanomsg',
              '-levent'
            ]
          }]
        ],
        'library_dirs': [
          '/usr/lib',
          '/usr/local/lib'
        ]
      }
    },
    {
      "target_name": "install",
      "dependencies": [ "liblibjam" ],
      "type": "none",
      "copies": [
        {
          "destination": "/usr/local/lib/",
          "files": [ "<(PRODUCT_DIR)/libjam.a" ]
        }
      ]
    },
    {
      "target_name": "tools",
      "type": "none",
      "copies": [
        {
          "destination": "/usr/local/bin/",
          "files": [ 
            "tools/jamrun",
            "tools/jamkill",
            "tools/jamterm",
            "tools/crun",
            "tools/jrun"
           ]
        }
      ]
    },
    {
   	  "target_name": "liblibjam",
	  	"type": "static_library",
      "dependencies": [ "deps/libtask/binding.gyp:liblibtask" ],
      "sources": [ 
      	"<!@(ls -1 lib/jamlib/*.c)"
      ],
      "configurations": {
      	"Debug": {
      		"conditions": [
      			 ['OS=="mac"', {
      			 	'xcode_settings': {
				        'OTHER_CFLAGS': [
				          '-c',
				          '-O1',
				          '-g',
				          '-fsanitize=address',
				          '-fno-omit-frame-pointer'
				        ]
				      }
      			 }],
      			 ['OS=="linux"', {
      			 	'cflags': [
      			 		'-c',
			          '-O1',
			          '-g',
			          '-fsanitize=address',
			          '-fno-omit-frame-pointer'
      			 	]
      			 }]
      		]
      	}
      },
      "copies": [
        {
          "destination": "/usr/local/share/jam/lib/",
          "files": [
            "<!@(ls -1 lib/jamlib/*.h)"
          ]
        },
        {
          "destination": "/usr/local/share/jam/deps/",
          "files": [
            "deps/fake_libc_include/",
          ]
        },
        {
          "destination": "/usr/local/share/jam/deps/libtask/",
          "files": [ "<(PRODUCT_DIR)/libtask.a" ]
        }
      ]
    }
  ]
}
