CC = clang -Wall -g 
AR = ar rcs
# CFLAGS =  -DDEBUG_LVL1 
LDFLAGS = libcbor.a -lnanomsg -ltask 

OBJECTS = activity.o simplequeue.o command.o coreconf.o core.o jam.o jamworker.o jamrunner.o \
		timer.o socket.o nvoid.o mydb.o dbutil.o cborutils.o threadsem.o jamsync.o jamasync.o

libjam.a: $(OBJECTS)
	$(AR) libjam.a $^ 
	cp libjam.a testers/.	

$(TESTOBJS): %.o: %.c
	$(CC) -c $(CFLAGS) $< -o $@


.PHONY: clean

clean:
	rm -f *.o
