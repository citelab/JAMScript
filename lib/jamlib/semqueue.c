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

#include "semqueue.h"


semqueue_t *semqueue_new(bool ownedbyq)
{
    char lockname[64];
	semqueue_t *pq = (semqueue_t *)calloc(1, sizeof(semqueue_t));
    pq->queue = queue_new(ownedbyq);

#ifdef linux
    sem_init(&pq->lock, 0, 0);
#elif __APPLE__
    sprintf(lockname, "/logger-sem-%d", getpid());
    sem_unlink(lockname);
    pq->lock = sem_open(lockname, O_CREAT, 0644, 0);
#endif

    return pq;
}

bool semqueue_enq(semqueue_t *queue, void *data, int len)
{
    queue_enq(queue->queue, data, len);

#ifdef linux
    sem_post(&queue->lock);
#elif __APPLE__
    sem_post(queue->lock);
#endif

    return true;
}

nvoid_t *semqueue_deq(semqueue_t *queue)
{
#ifdef linux
    sem_wait(&queue->lock);
#elif __APPLE__
    sem_wait(queue->lock);
#endif

    return queue_deq(queue->queue);
}
