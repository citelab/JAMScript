IDIR=/usr/local/include
LDIR=/usr/local/lib

CC=gcc
CFLAGS=-I$(IDIR) -Wall

LIBS=-lzmq -lczmq

OBJ=bloom.o MurmurHash2.o jobject.o jservice.o jclient.o ldaemon.o

%.o:	%.c
	$(CC) -c $< $(CFLAGS) -o $@

jservice:	$(OBJ)
	$(CC) -o $@ $^ -L$(LDIR) $(LIBS)

.PHONY:		clean

clean:
	rm -f *.o core *~ jservice
