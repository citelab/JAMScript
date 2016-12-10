CC = clang -Wall -g 
AR = ar rcs
CFLAGS =  -DDEBUG_LVL1 -I../. -lm
LDFLAGS = -lbsd -pthread -lcbor -lnanomsg ./libjam.a -ltask -levent -lhiredis


all: C2J_async_test C2J_sync_test J2C_async_test J2C_sync_test chat redis_chat


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

redis:   Xiru_JAM_Tests/redis.c
	$(CC) -o redis Xiru_JAM_Tests/redis.c $(CFLAGS) $(LDFLAGS)

redis_chat:   Xiru_JAM_Tests/redis_chat.c
	$(CC) -o redis_chat Xiru_JAM_Tests/redis_chat.c $(CFLAGS) $(LDFLAGS)

res_node:   Xiru_JAM_Tests/res_node.c Xiru_JAM_Tests/duktape/duktape.c
	$(CC) -o res_node Xiru_JAM_Tests/res_node.c  Xiru_JAM_Tests/duktape/duktape.c $(CFLAGS) $(LDFLAGS)
.PHONY: clean

clean:
	rm -rf *.dSYM C2J_async_test C2J_sync_test J2C_async_test J2C_sync_test chat redis_chat res_node
