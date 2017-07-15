{
  "make_global_settings": [
    ["CC", "/usr/bin/clang"],
    ["LINK", "/usr/bin/clang"]
  ],
  "targets": [
    {
      "target_name": "liblibtask",
    	"type": "static_library",
      "sources": [ 
        "asm.S",
        "channel.c",
        "context.c",
        "fd.c",
        "net.c",
        "print.c",
        "qlock.c",
        "rendez.c",
        "task.c"
      ]
    }
  ]
}