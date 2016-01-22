makelib:	toml.c tparser.c files.c date_parser.c
		gcc -c -fPIC toml.c -o toml.o
		gcc -c -fPIC files.c -o files.o
		gcc -c -fPIC tparser.c -o tparser.o
		gcc -c -fPIC date_parser.c -o date_parser.o
		gcc -shared -Wl,-soname,libtoml.so -o libtoml.so toml.o date_parser.o files.o tparser.o
		rm *.o
