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

#ifndef __SEM_QUEUE_H__
#define __SEM_QUEUE_H__

#include <fcntl.h>
#include <sys/stat.h>
#include <semaphore.h>
#include <unistd.h>

#include "simplequeue.h"

/*
 * This "push" queue is asymmetric. The thread that is waiting for the input
 * is woken up when a message put into the queue.
 */

typedef struct _semqueue_t
{
	simplequeue_t *queue;
#ifdef linux
    sem_t lock;
#elif __APPLE__
    sem_t *lock;
#endif

} semqueue_t;


/*
 * function prototypes
 */

semqueue_t *semqueue_new(bool ownedbyq);
bool semqueue_enq(semqueue_t *queue, void *data, int len);
nvoid_t *semqueue_deq(semqueue_t *queue);

#endif
