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

#ifndef __EVENT_H__
#define __EVENT_H__

#include <cbor.h>

typedef enum eventtype_t
{
    ErrorEventType,
    CompleteEventType,
    CallbackEventType
} eventtype_t;

/**
 * Event Structures
 */
typedef struct _errorevent_t
{
    cbor_item_t *ecode;
} errorevent_t;

typedef struct _completeevent_t
{
    cbor_item_t *rval;
} completeevent_t;


/**
 * General Event structure
 */
typedef struct _event
{
    eventtype_t type;
    char *actname;
    char *callback;
    union {
        errorevent_t error;
        completeevent_t comp;
    } val;
} event_t;

/** Event constructors */
void event_free(event_t *e);
event_t *event_error_new(char *aname, cbor_item_t *ecode, char *ecallback);
event_t *event_complete_new(char *aname, cbor_item_t *rval, char *ccallback);
event_t *event_callback_new(char *aname);

#endif

#ifdef __cplusplus
}
#endif
