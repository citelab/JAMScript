/*

The MIT License (MIT)
Copyright (c) 2011 Derek Ingrouville, Julien Lord, Muthucumaru Maheswaran

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
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "callback.h"


/* Create and initialize a new callbacklist_t
 * next is initialized to NULL automatically
 */
callbacklist_t *callbacklist_new()
{
    callbacklist_t *list = NULL;

    list = (callbacklist_t *) calloc(1, sizeof(callbacklist_t));
    return list;
}

/* Free an callbacklist_t */
void callbacklist_free(callbacklist_t *list)
{
    callbacklist_t *curr = NULL;
    callbacklist_t *tmp = NULL;

    curr = list;

    while (curr != NULL) {
        tmp = curr;
        curr = curr->next;

        free(tmp);
    }
}

/* Has been modified so that activity name is matched before the callback is
 * triggered.
 */
void callbacklist_call(callbacklist_t *list, struct jamstate_t *jam, event_t *event)
{
    callbacklist_t *curr = NULL;
    event_callback_f cb = NULL;

    curr = list;

    while (curr != NULL) {
        cb = curr->cb;
        if (event->actname == NULL)
            cb(jam, event, curr->data);
        else if (curr->aname != NULL && strcmp(curr->aname, event->actname) == 0)
            cb(jam, event, curr->data);
        curr = curr->next;
    }
}

/* Add a new callback to the head of the linked list
 * Returns the head of the list
 */
callbacklist_t *callbacklist_add(callbacklist_t *list, char *aname, event_callback_f cb, void *data)
{
    callbacklist_t *newHead = callbacklist_new();

    newHead->aname = aname;
    newHead->cb = cb;
    newHead->data = data;
    newHead->next = list;

    return newHead;
}

callbacks_t *callbacks_new()
{
    callbacks_t *cbs = NULL;

    cbs = (callbacks_t *) calloc(1, sizeof(callbacks_t));

    return cbs;
}

void callbacks_free(callbacks_t *callbacks)
{
    if (callbacks == NULL)
        return;

    callbacklist_free(callbacks->complete_handlers);
    callbacklist_free(callbacks->error_handlers);

    free(callbacks);
}

void callbacks_add(callbacks_t *callbacks, char *actname, eventtype_t type, event_callback_f cb,  void *data)
{
    if (callbacks == NULL)
        return;

    switch (type) {
        /* Other types of handlers will be added here.. */
        case CompleteEventType:
            callbacks->complete_handlers = callbacklist_add(callbacks->complete_handlers, actname, cb, data);
            break;
        case ErrorEventType:
            callbacks->error_handlers = callbacklist_add(callbacks->error_handlers, actname, cb, data);
            break;
        case CallbackEventType:
            callbacks->cback_handlers = callbacklist_add(callbacks->cback_handlers, actname, cb, data);
        break;
    }
    return;
}

void callbacks_call(callbacks_t *callbacks, struct jamstate_t *jam, event_t *event)
{
    switch(event->type) {
        /* Other types of handlers will be added here.. */
        case CompleteEventType:
            callbacklist_call(callbacks->complete_handlers, jam, event);
            break;
        case ErrorEventType:
            callbacklist_call(callbacks->error_handlers, jam, event);
            break;
        case CallbackEventType:
            callbacklist_call(callbacks->cback_handlers, jam, event);
            break;
    }
    event_free(event);
}
