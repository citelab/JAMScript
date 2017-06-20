/*
The MIT License (MIT)
Copyright (c) 2016 Muthucumaru Maheswaran

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:
The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

#ifndef __PUSH_QUEUE_H__
#define __PUSH_QUEUE_H__

#include "threadsem.h"
#include "simplequeue.h"

/*
 * This "push" queue is asymmetric. The thread that is waiting for the input 
 * is woken up when a message put into the queue. 
 */

typedef struct _pushqueue_t
{
	simplequeue_t *queue;
    threadsem_t *sem;

} pushqueue_t;


typedef struct _push2queue_t
{
	struct nn_pollfd fds[2];

	simplequeue_t *hqueue;
	simplequeue_t *lqueue;
    threadsem_t *sem;

} push2queue_t;


/*
 * function prototypes
 */

pushqueue_t *pqueue_new(bool ownedbyq);
bool pqueue_delete(pushqueue_t *queue);

bool pqueue_enq(pushqueue_t *queue, void *data, int len);
nvoid_t *pqueue_deq(pushqueue_t *queue);

push2queue_t *p2queue_new(bool ownedbyq);
bool p2queue_delete(push2queue_t *queue);

bool p2queue_enq_low(push2queue_t *queue, void *data, int len);
bool p2queue_enq_high(push2queue_t *queue, void *data, int len);
nvoid_t *p2queue_deq(push2queue_t *queue);
nvoid_t *p2queue_deq_high(push2queue_t *queue);

#endif
