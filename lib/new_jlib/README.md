# jamc2
## TODO
In vscode, or in grep, search for "TODO" in rtsched.c, and there are 2 comments.
- Parse schedule
- Serialize BID Request

## examples
### ```mqtt_simple_publish.c``` and ```mqtt_simple_subscribe.c```
test the capability of underlying scheduler and mqtt client
```
gcc mqtt_simple_[publish|subscribe].c priorityqueue.c mqtt.c rtsched.c task_allocator.c baseexecutor.c mqtt_manager.c context.c mqtt_pal.c timeout.c pqueue.c funcreg.c timer.c list.c sync.c -o mqtt_simple_publish -lm -lpthread -lcbor
```
### ```mqtt_test_callee.c``` and ```mqtt_test_caller.c```
```gcc baseexecutor.c context.c funcreg.c list.c mqtt_manager.c mqtt_pal.c mqtt.c pqueue.c priorityqueue.c rtsched.c sync.c task_allocator.c timeout.c timer.c mqtt_test_callee.c -o mqtt_test_callee -lpthread -lcbor -lm
```
- test the efficiency for worker to process C2J calls with controllers
- M controller -- M mqtt broker -- 1 worker
- for mqtt_test_callee, the first argument is the UUID of controller [2, ..., 2 + M), the second argument is the number of threads to be used by each controller
- for mqtt_test_caller, the first argument is the number of controllers M, the second argument is the number of threads to be used by the worker
### ```preemption.c```
test the capability of the underlying coro library to do preemption
```
gcc preemption.c priorityqueue.c mqtt.c rtsched.c task_allocator.c baseexecutor.c mqtt_manager.c context.c mqtt_pal.c timeout.c pqueue.c funcreg.c timer.c list.c sync.c -o preemption -lm -lpthread -lcbor
```
just run it
### ```single_msg_client.c``` and ```single_msg_client.c```
```
gcc single_msg_client.c priorityqueue.c mqtt.c rtsched.c task_allocator.c baseexecutor.c mqtt_manager.c context.c mqtt_pal.c timeout.c pqueue.c funcreg.c timer.c list.c sync.c -o single_msg_client -lm -lpthread -lcbor
```
test the latency of receiving the first response
run broker, run server, then client, no surprise
### ```skynet2.c```
```
gcc skynet2.c priorityqueue.c mqtt.c rtsched.c task_allocator.c baseexecutor.c mqtt_manager.c context.c mqtt_pal.c timeout.c pqueue.c funcreg.c timer.c list.c sync.c -o skynet2 -lm -lpthread -lcbor
```
test the efficiency of task scheduling
just run it, no surprise
