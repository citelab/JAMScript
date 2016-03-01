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

#include <nanomsg/nn.h>
#include <nanomsg/pipeline.h>

#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <assert.h>


#include "simplequeue.h"

/*
 * Helper to create a random name string..
 * we arbitrarily set the length of the name to 16 chars
 */
char *random_name()
{
	char *carray = "ABCDEFGHIJKLMNOPQRSTUVXWZ0123456789abcdefghijklmnopqrstuvwxyz_";
	int i = 0;
	char buf[17];

	for (i = 0; i < 16; i++)
		buf[i] = carray[arc4random_uniform(strlen(carray))];
	buf[16] = 0;

	return strdup(buf);
}

/*
 * Create a simple queue..
 */
simplequeue_t *create_simple_queue(bool ownedbyq)
{
	simplequeue_t *sq = (simplequeue_t *)calloc(1, sizeof(simplequeue_t));
	assert(sq != NULL);

	sq->pullsock = nn_socket(AF_SP, NN_PULL);
	assert(sq->pullsock >= 0);

	// try to create a socket.. find a name that is not already used
	while(1) {
		char *name = random_name();
		char buf[32];
		sprintf(buf, "inproc://%s", name);
		free(name);
		if (nn_bind(sq->pullsock, buf) >= 0) {
			sq->name = strdup(buf);
			break;
		}
	}

	sq->pushsock = nn_socket(AF_SP, NN_PUSH);
	assert(sq->pushsock >= 0);
	nn_connect(sq->pushsock, sq->name);
	sq->ownedbyq = ownedbyq;

	return sq;
}

bool destroy_simple_queue(simplequeue_t *sq)
{
	if (nn_shutdown(sq->pushsock, 0) < 0)
		return false;
	free(sq);

	return true;
}

/*
 * Push the data or a copy of the data into the queue.
 * If ownedbyq is true, then the queue has a locally owned copy of the data.
 */
bool enqueue(simplequeue_t *sq, void *data, int size)
{
	datawrapper_t *dw = (datawrapper_t *)calloc(1, sizeof(datawrapper_t));
	dw->size = size;
	if (sq->ownedbyq) {
		void *ndata = calloc(1, size);
		memcpy(ndata, data, size);
		dw->data = ndata;
	}
	else
		dw->data = data;

	int dwsize = sizeof(datawrapper_t);
	int bytes = nn_send (sq->pushsock, dw, dwsize, 0);
	free(dw);

	if (bytes == dwsize)
		return true;
	else
		return false;
}

void *dequeue(simplequeue_t *sq)
{
	char *buf = NULL;
	int bytes = nn_recv (sq->pullsock, &buf, NN_MSG, 0);

	if (bytes != sizeof(datawrapper_t)) {
		nn_freemsg(buf);
		return NULL;
	}
	else
	{
		void *data = ((datawrapper_t *)buf)->data;
		nn_freemsg(buf);
		return data;
	}
}


/*
 * Simple tester for the simplequeue..
 */

int main(void)
{
	simplequeue_t *q = create_simple_queue(true);

	char *buf = malloc(100);
	strcpy(buf, "Hello World.. 1234");
	enqueue(q, buf, strlen(buf) + 1);

	printf("After enqueue..\n");
	free(buf);

	char *s = dequeue(q);
	printf("Pointer %p\n", s);
	printf("Dequeued .. %s\n", s);

	destroy_simple_queue(q);


	//TODO: Expand this into a proper tester..
	// Use the random generator of strings.. to pump stuff into the
	// queue.. check whether things are coming in the order in which
	// it goes in.. things retrieved... need a generator capable of
	// generating different length strings.
}
