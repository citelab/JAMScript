CC = gcc -Wall
CFLAGS = -I../../../deps/libtask
LDFLAGS = -lcbor -lnanomsg ./libtask.a

OBJECTS = activity.o simplequeue.o command.o coreconf.o core.o jamlib.o jamworker.o callback.o \
		timer.o socket.o nvoid.o event.o mydb.o dbutil.o cborutils.o

testjam: $(OBJECTS)
	$(CC) -o $@ $^ $(CFLAGS) $(LDFLAGS)

$(OBJECTS): %.o: %.c
	$(CC) -c $(CFLAGS) $< -o $@

.PHONY: clean

clean:
	rm -f *.o
