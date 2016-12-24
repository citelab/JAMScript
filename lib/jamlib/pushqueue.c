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

#include <stdlib.h>

#include "pushqueue.h"
#include "threadsem.h"

pushqueue_t *pqueue_new(bool ownedbyq)
{
	pushqueue_t *pq = (pushqueue_t *)calloc(1, sizeof(pushqueue_t));

    pq->queue = queue_new(ownedbyq);
    pq->sem = threadsem_new();

    return pq;
}

bool pqueue_delete(pushqueue_t *pq)
{
    if (queue_delete(pq->queue) == true)
    {
        threadsem_free(pq->sem);
        return true;
    }

    return false;    
}


bool pqueue_enq(pushqueue_t *queue, void *data, int len)
{
    queue_enq(queue->queue, data, len);
    thread_signal(queue->sem);

    // TODO: Fix the return value..
    return true;
}

nvoid_t *pqueue_deq(pushqueue_t *queue)
{
    task_wait(queue->sem);
    return queue_deq(queue->queue);
}

nvoid_t *pqueue_deq_timeout(pushqueue_t *queue, int timeout)
{
    task_wait(queue->sem);
    return queue_deq_timeout(queue->queue, timeout);
}