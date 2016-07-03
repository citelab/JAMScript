CC = clang -Wall -g 
AR = ar rcs
CFLAGS =  -DDEBUG_LVL1 -I../. -I/home/richboy/Downloads/hiredis-master

LDFLAGS = -lcbor -lnanomsg -ltask -lpthread -lbsd -ljam -levent ./libhiredis.a ./libtask.a


all: C2J_async_test C2J_sync_test J2C_async_test J2C_sync_test chat richboy


C2J_sync_test: C2J_sync_test.c 
	$(CC) -o C2J_sync_test C2J_sync_test.c $(CFLAGS) $(LDFLAGS)
	
C2J_async_test: C2J_async_test.c 
	$(CC) -o C2J_async_test C2J_async_test.c $(CFLAGS) $(LDFLAGS)
	
J2C_sync_test: J2C_sync_test.c 
	$(CC) -o J2C_sync_test J2C_sync_test.c $(CFLAGS) $(LDFLAGS)
	
J2C_async_test: J2C_async_test.c 
	$(CC) -o J2C_async_test J2C_async_test.c $(CFLAGS) $(LDFLAGS)
	
chat:	Xiru_JAM_Tests/chat.c
	$(CC) -o chat Xiru_JAM_Tests/chat.c $(CFLAGS) $(LDFLAGS)

richboy:	richboy_tests/test.c
	$(CC) -o richboy richboy_tests/test.c $(CFLAGS) $(LDFLAGS)

.PHONY: clean

clean:
	rm -rf *.dSYM C2J_async_test C2J_sync_test J2C_async_test J2C_sync_test chat richboy
