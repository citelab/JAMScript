OS := $(shell uname)
ifeq ($(OS),Darwin)
	CC := gcc-6
else
	CC := gcc
endif


jamrun:	jamrun.c jamrun.h jxereader.c jxereader.h
	$(CC) -Wall -I/usr/local/include -L/usr/local/lib -DHAVE_PTHREAD_RWLOCK=1 -DHAVE_GETOPT_LONG=1 jamrun.c jamrun.h jxereader.c jxereader.h toml/toml.c toml/tparser.c toml/date_parser.c toml/files.c -larchive -o jamrun -lslack -ldl

clean:	
	rm -f jamrun
