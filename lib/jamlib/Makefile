CC = clang -Wall -g 
AR = ar rcs
# CFLAGS =  -DDEBUG_LVL1 
LDFLAGS = -lbsd libcbor.a -lnanomsg -ltask -levent -lhiredis

OBJECTS = activity.o simplequeue.o command.o coreconf.o core.o jam.o jamworker.o jamrunner.o \
		timer.o socket.o nvoid.o mydb.o dbutil.o cborutils.o threadsem.o jamsync.o jamasync.o jdata.o jcondition.o duktape/duktape.o

libjam.a: $(OBJECTS)
	$(AR) libjam.a $^ 
	cp libjam.a testers/.	

$(OBJECTS): %.o: %.c
	$(CC) -c $(CFLAGS) $< -o $@

.PHONY: clean

clean:
	rm -f *.o
	cd duktape
	rm -f *.o
