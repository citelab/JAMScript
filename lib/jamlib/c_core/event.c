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

#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include "event.h"

#define NEW(type) (type *)calloc(1, sizeof(type))

void event_free(event_t *e)
{
    if (e == NULL)
        return;

    free(e);
}

event_t *event_error_new(char *aname, cbor_item_t *ecode, char *ecallback)
{
    event_t *e = NEW(event_t);
    e->type = ErrorEventType;
    e->actname = aname;
    e->callback = ecallback;

    e->val.error.ecode = ecode;
    return e;
}

event_t *event_complete_new(char *aname, cbor_item_t *rval, char *ccallback)
{
    event_t *e = NEW(event_t);
    e->type = CompleteEventType;
    e->actname = aname;
    e->callback = ccallback;

    e->val.comp.rval = rval;
    return e;
}

event_t *event_callback_new(char *aname)
{
    event_t *e = NEW(event_t);
    e->type = CallbackEventType;
    e->actname = aname;

    return e;
}
