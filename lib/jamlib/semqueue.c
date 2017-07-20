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
#include <stdio.h>

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


push2queue_t *p2queue_new(bool ownedbyq)
{
	push2queue_t *pq = (push2queue_t *)calloc(1, sizeof(push2queue_t));
    pq->hqueue = queue_new(ownedbyq);
    pq->lqueue = queue_new(ownedbyq);
    pq->sem = threadsem_new();

    pq->fds[0].fd = pq->hqueue->pullsock;
    pq->fds[0].events = NN_POLLIN;
    pq->fds[1].fd = pq->lqueue->pullsock;
    pq->fds[1].events = NN_POLLIN;

    return pq;
}

bool p2queue_delete(push2queue_t *pq)
{
    if ((queue_delete(pq->hqueue) == true) &&
        (queue_delete(pq->lqueue) == true))
    {
        threadsem_free(pq->sem);
        return true;
    }

    return false;
}


bool p2queue_enq_low(push2queue_t *queue, void *data, int len)
{
    queue_enq(queue->lqueue, data, len);
    thread_signal(queue->sem);

    // TODO: Fix the return value..
    return true;
}


bool p2queue_enq_high(push2queue_t *queue, void *data, int len)
{
    queue_enq(queue->hqueue, data, len);
    thread_signal(queue->sem);

    // TODO: Fix the return value..
    return true;
}


nvoid_t *p2queue_deq(push2queue_t *queue)
{
    task_wait(queue->sem);

    int rc = nn_poll(queue->fds, 2, 20000);

    if (rc == 0)
        return NULL;
    if (queue->fds[0].revents & NN_POLLIN)
        return queue_deq(queue->hqueue);
    else
        return queue_deq(queue->lqueue);
}


nvoid_t *p2queue_deq_high(push2queue_t *queue)
{
    while (1) {
        task_wait(queue->sem);

        int rc = nn_poll(queue->fds, 2, 20000);

        if (rc == 0)
            return NULL;

        if (queue->fds[0].revents & NN_POLLIN)
            return queue_deq(queue->hqueue);
    }
}
