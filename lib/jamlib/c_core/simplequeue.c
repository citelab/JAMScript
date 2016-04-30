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

#include "nvoid.h"

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
simplequeue_t *queue_new(bool ownedbyq)
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
	sq->ownedbyq = false; //ownedbyq;

	#ifdef DEBUG_MSGS
		printf("Queue created at %s\n", sq->name);
	#endif
		
	return sq;
}

bool queue_delete(simplequeue_t *sq)
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
bool queue_enq(simplequeue_t *sq, void *data, int size)
{
	nvoid_t *dw = (nvoid_t *)calloc(1, sizeof(nvoid_t));

	dw->len = size;
	if (sq->ownedbyq) {
		void *ndata = calloc(1, size);
		memcpy(ndata, data, size);
		dw->data = ndata;
	}
	else
		dw->data = data;

	int dwsize = sizeof(nvoid_t);
	int bytes = nn_send (sq->pushsock, dw, dwsize, 0);
	free(dw);

	if (bytes == dwsize)
		return true;
	else
		return false;
}

nvoid_t *queue_deq(simplequeue_t *sq)
{
	char *buf = NULL;
	int bytes = nn_recv (sq->pullsock, &buf, NN_MSG, 0);

	if (bytes != sizeof(nvoid_t)) {
		nn_freemsg(buf);
		return NULL;
	}
	else
	{
		nvoid_t *data = (nvoid_t *)calloc(1, sizeof(nvoid_t));
		memcpy(data, buf, sizeof(nvoid_t));
		nn_freemsg(buf);
		// why? I don't know. May be I could have just returned buf without releasing it.
		return data;
	}
}

nvoid_t *queue_deq_timeout(simplequeue_t *sq, int timeout)
{
	struct nn_pollfd pfd[1];
	pfd[0].fd = sq->pullsock;
	pfd[0].events = NN_POLLIN;

	int rc = nn_poll(pfd, 1, timeout);
	if (rc == 0) {
		return NULL;
	}
	else
	if (pfd[0].revents & NN_POLLIN)
		return queue_deq(sq);

	return NULL;
}


void queue_print(simplequeue_t *sq)
{
	printf("Queue name: %s\n", sq->name);
	printf("Queue ");
	if (sq->ownedbyq)
		printf("owns the objects\n");
	else
		printf("does NOT own the objects\n");
	printf("Pushsock = %d, pullsock = %d\n", sq->pushsock, sq->pullsock);
}


// See the testers folder for testing routine for the simple queue module.
