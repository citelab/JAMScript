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
#include "callback.h"



/* Create and initialize a new CallbackList */
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

void callbacklist_call(CallbackList *list, struct Application *app, Event *event)
{
    CallbackList *curr = NULL;
    EventCallback cb = NULL;
    
    curr = list;

    while (curr != NULL) {
        cb = curr->cb;
        cb(app, event, curr->data);
        curr = curr->next;
    }
}

/* Add a new callback to the head of the linked list 
 * Returns the head of the list
 */
CallbackList *callbacklist_add(CallbackList *list, EventCallback cb, void *data)
{
    CallbackList *newHead = callbacklist_new();
    
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
        
    callbacklist_free(callbacks->clickHandlers);
    callbacklist_free(callbacks->mouseDownHandlers);
    callbacklist_free(callbacks->mouseMoveHandlers);
    callbacklist_free(callbacks->mouseDragHandlers);
    callbacklist_free(callbacks->mouseDragOutHandlers);
    callbacklist_free(callbacks->exposeHandlers);
    callbacklist_free(callbacks->setupHandlers);
    callbacklist_free(callbacks->fileDropInitHandlers);
    callbacklist_free(callbacks->fileDropChunkHandlers);
    callbacklist_free(callbacks->fileDropEndHandlers);
    callbacklist_free(callbacks->b64FileDropInitHandlers);
    callbacklist_free(callbacks->b64FileDropChunkHandlers);
    callbacklist_free(callbacks->b64FileDropEndHandlers);
    callbacklist_free(callbacks->preLoadHandlers);
    callbacklist_free(callbacks->resizeHandlers);
    callbacklist_free(callbacks->keyTypedHandlers);
    callbacklist_free(callbacks->keyPressedHandlers);
    callbacklist_free(callbacks->keyReleasedHandlers);
    callbacklist_free(callbacks->buttonClickHandlers);
    
    free(callbacks);
}

void callbacks_add(Callbacks *callbacks, EventType type, EventCallback cb,  void *data)
{
    if (callbacks == NULL)
        return;
       
    switch(type) {
        case ExposeEventType:
            callbacks->exposeHandlers = callbacklist_add(callbacks->exposeHandlers, cb, data);
        break;
        case SetupEventType:
            callbacks->setupHandlers = callbacklist_add(callbacks->setupHandlers, cb, data);
        break;
        case ClickEventType:
             callbacks->clickHandlers = callbacklist_add(callbacks->clickHandlers, cb, data);
        break;
        case MouseDownEventType:
             callbacks->mouseDownHandlers = callbacklist_add(callbacks->mouseDownHandlers, cb, data);
        break;
        case MouseMoveEventType:
             callbacks->mouseMoveHandlers = callbacklist_add(callbacks->mouseMoveHandlers, cb, data);
        break;
        case MouseDragEventType:
             callbacks->mouseDragHandlers = callbacklist_add(callbacks->mouseDragHandlers, cb, data);
        break;
        case MouseDragOutEventType:
            callbacks->mouseDragOutHandlers = callbacklist_add(callbacks->mouseDragOutHandlers, cb, data);
        break;
        case FileDropInit:
             callbacks->fileDropInitHandlers = callbacklist_add(callbacks->fileDropInitHandlers, cb, data);
        break;
        case FileDropChunkReceived:
             callbacks->fileDropChunkHandlers = callbacklist_add(callbacks->fileDropChunkHandlers, cb, data);
        break;
        case FileDropEnd:
             callbacks->fileDropEndHandlers = callbacklist_add(callbacks->fileDropEndHandlers, cb, data);
        break;
        case b64FileDropInit:
             callbacks->b64FileDropInitHandlers = callbacklist_add(callbacks->b64FileDropInitHandlers, cb, data);
        break;
        case b64FileDropChunkReceived:
             callbacks->b64FileDropChunkHandlers = callbacklist_add(callbacks->b64FileDropChunkHandlers, cb, data);
        break;
        case b64FileDropEnd:
             callbacks->b64FileDropEndHandlers = callbacklist_add(callbacks->b64FileDropEndHandlers, cb, data);
        break;
        case PreLoad:
             callbacks->preLoadHandlers = callbacklist_add(callbacks->preLoadHandlers, cb, data);
        break;
        case Resize:
             callbacks->resizeHandlers = callbacklist_add(callbacks->resizeHandlers, cb, data);
        break;
        case KeyTyped:
            callbacks->keyTypedHandlers = callbacklist_add(callbacks->keyTypedHandlers, cb, data);
        break;
        case KeyPressed:
            callbacks->keyPressedHandlers = callbacklist_add(callbacks->keyPressedHandlers, cb, data);
        break;
        case KeyReleased:
            callbacks->keyReleasedHandlers = callbacklist_add(callbacks->keyReleasedHandlers, cb, data);
        break;
        case ButtonClickEventType:
             callbacks->buttonClickHandlers = callbacklist_add(callbacks->buttonClickHandlers, cb, data);
        break;
    }
    
    return;
}

void callbacks_call(Callbacks *callbacks, struct Application *app, Event *event)
{
    switch(event->type) {
        case ExposeEventType: 
            callbacklist_call(callbacks->exposeHandlers, app, event);
        break;
        case SetupEventType:
            callbacklist_call(callbacks->setupHandlers, app, event);
        break;
        case ClickEventType: 
            callbacklist_call(callbacks->clickHandlers, app, event);
        break;
        case MouseDownEventType: 
            callbacklist_call(callbacks->mouseDownHandlers, app, event);
        break;
        case MouseMoveEventType: 
            callbacklist_call(callbacks->mouseMoveHandlers, app, event);
        break;
        case MouseDragEventType: 
            callbacklist_call(callbacks->mouseDragHandlers, app, event);
        break;
        case MouseDragOutEventType:
            callbacklist_call(callbacks->mouseDragOutHandlers, app, event);
        break;
        case FileDropInit: 
            callbacklist_call(callbacks->fileDropInitHandlers, app, event);
        break;
        case FileDropChunkReceived:
            callbacklist_call(callbacks->fileDropChunkHandlers, app, event);
        break;
        case FileDropEnd:
            callbacklist_call(callbacks->fileDropEndHandlers, app, event);
        break;
        case b64FileDropInit:
            callbacklist_call(callbacks->b64FileDropInitHandlers, app, event);
        break;
        case b64FileDropChunkReceived:
            callbacklist_call(callbacks->b64FileDropChunkHandlers, app, event);
        break;
        case b64FileDropEnd:
            callbacklist_call(callbacks->b64FileDropEndHandlers, app, event);
        break;
        case PreLoad: 
            callbacklist_call(callbacks->preLoadHandlers, app, event);
        break;
        case Resize:
            callbacklist_call(callbacks->resizeHandlers, app, event);
        break;
        case KeyTyped:
            callbacklist_call(callbacks->keyTypedHandlers, app, event);
        break;
        case KeyPressed:
            callbacklist_call(callbacks->keyPressedHandlers, app, event);
        break;
        case KeyReleased:
            callbacklist_call(callbacks->keyReleasedHandlers, app, event);
        break;
        case ButtonClickEventType:
            callbacklist_call(callbacks->buttonClickHandlers, app, event);
        break;
    }
    event_free(event);
}
