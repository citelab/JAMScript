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

#ifdef __cplusplus
extern "C" {
#endif

#ifndef __CALLBACK_H__
#define __CALLBACK_H__

#include "event.h"

struct _jamstate_t;

typedef void (*event_callback_f)(struct _jamstate_t *d, event_t *e, void *data);

typedef struct _callbacklist_t {
    char *aname;
    event_callback_f cb;
    void *data;
    struct _callbacklist_t *next;
} callbacklist_t;

typedef struct _callbacks_t {
    /* Other types of callback handlers could be added here. */
    callbacklist_t *error_handlers;
    callbacklist_t *complete_handlers;
    callbacklist_t *cback_handlers;
} callbacks_t;

callbacklist_t *callbacklist_new();
void callbacklist_free(callbacklist_t *list);
callbacklist_t *callbacklist_add(callbacklist_t *list, char *aname, event_callback_f cb, void *data);
void callbacklist_call(callbacklist_t *list, struct _jamstate_t *jam, event_t *event);

callbacks_t *callbacks_new();
void callbacks_free(callbacks_t *callbacks);
void callbacks_add(callbacks_t *callbacks, char *actname, eventtype_t type, event_callback_f cb,  void *data);
void callbacks_call(callbacks_t *callbacks, struct _jamstate_t *jam, event_t *event);

#endif /* __CALLBACK_H__ */

#ifdef __cplusplus
}
#endif
