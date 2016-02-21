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

#ifndef __SIMPLE_QUEUE_H__
#define __SIMPLE_QUEUE_H__

#include <nanomsg/nn.h>
#include <stdbool.h>


/*
 * Implementation idea is very simple. Just use a nano message pipeline.
 * Stick the messages into the pipeline when enqueuing. Dequeue from the pipeline
 * itself. The thread that is trying to dequeue from the pipeline will get stuck
 * if there is no items in the pipeline.

 * The cool thing with this implementation is that it could be used with threads
 * without threads .. with the threadless "select-based" approach. Just watch the
 * pipeline using a select.
 */

/*
 * the queue is represented by integers for the pull and push sides..
 * because nanomsg queues are POSIX compliant .. they are just sockets..
 */
typedef struct _simplequeue_t
{
	char *name;
	int pushsock, pullsock;
	bool ownedbyq;

} simplequeue_t;


typedef struct _datawrapper_t
{
	void *data;
	int size;

} datawrapper_t;

/*
 * function prototypes
 */

simplequeue_t *create_simple_queue(bool ownedbyq);
bool destroy_simple_queue(simplequeue_t *queue);

bool enqueue(simplequeue_t *queue, void *data, int size);
void *dequeue(simplequeue_t *queue);

#endif
