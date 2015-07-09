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


/* Create and initialize a new CallbackList
 * next is initialized to NULL automatically
 */
CallbackList *callbacklist_new()
{
    CallbackList *list = NULL;

    list = (CallbackList *) calloc(1, sizeof(CallbackList));
    return list;
}

/* Free an CallbackList */
void callbacklist_free(CallbackList *list)
{
    CallbackList *curr = NULL;
    CallbackList *tmp = NULL;

    curr = list;

    while (curr != NULL) {
        tmp = curr;
        curr = curr->next;

        free(tmp);
    }
}

// Has been modified so that activity name is matched before the callback is
// triggered.
//
void callbacklist_call(CallbackList *list, struct Application *app, Event *event)
{
    CallbackList *curr = NULL;
    EventCallback cb = NULL;

    curr = list;

    while (curr != NULL) {
        cb = curr->cb;
        if (event->actname == NULL)
            cb(app, event, curr->data);
        else if (curr->aname != NULL && strcmp(curr->aname, event->actname) == 0)
            cb(app, event, curr->data);
        curr = curr->next;
    }
}

/* Add a new callback to the head of the linked list
 * Returns the head of the list
 */
CallbackList *callbacklist_add(CallbackList *list, char *aname, EventCallback cb, void *data)
{
    CallbackList *newHead = callbacklist_new();

    newHead->aname = aname;
    newHead->cb = cb;
    newHead->data = data;
    newHead->next = list;

    return newHead;
}

Callbacks *callbacks_new()
{
    Callbacks *cbs = NULL;

    cbs = (Callbacks *) calloc(1, sizeof(Callbacks));

    return cbs;
}

void callbacks_free(Callbacks *callbacks)
{
    if (callbacks == NULL)
        return;

    callbacklist_free(callbacks->completeHandlers);
    callbacklist_free(callbacks->errorHandlers);
    callbacklist_free(callbacks->cancelHandlers);
    callbacklist_free(callbacks->verifyHandlers);

    free(callbacks);
}

void callbacks_add(Callbacks *callbacks, char *actname, EventType type, EventCallback cb,  void *data)
{
    if (callbacks == NULL)
        return;

    switch (type) {
        // Other types of handlers will be added here..
        case CompleteEventType:
            callbacks->completeHandlers = callbacklist_add(callbacks->completeHandlers, actname, cb, data);
            break;
        case ErrorEventType:
            callbacks->errorHandlers = callbacklist_add(callbacks->errorHandlers, actname, cb, data);
            break;
        case CancelEventType:
            callbacks->cancelHandlers = callbacklist_add(callbacks->cancelHandlers, actname, cb, data);
            break;
        case VerifyEventType:
            callbacks->verifyHandlers = callbacklist_add(callbacks->verifyHandlers, actname, cb, data);
            break;
        case CallbackEventType:
            callbacks->callbackHandlers = callbacklist_add(callbacks->callbackHandlers, actname, cb, data);
        break;
    }
    return;
}

void callbacks_call(Callbacks *callbacks, struct Application *app, Event *event)
{
    switch(event->type) {
        // Other types of handlers will be added here..
        case CompleteEventType:
            callbacklist_call(callbacks->completeHandlers, app, event);
            break;
        case ErrorEventType:
            callbacklist_call(callbacks->errorHandlers, app, event);
            break;
        case CancelEventType:
            callbacklist_call(callbacks->cancelHandlers, app, event);
            break;
        case VerifyEventType:
            callbacklist_call(callbacks->verifyHandlers, app, event);
            break;
        case CallbackEventType:
            callbacklist_call(callbacks->callbackHandlers, app, event);
            break;
    }
    event_free(event);
}
