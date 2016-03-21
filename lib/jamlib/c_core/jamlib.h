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

#ifdef __cplusplus
extern "C" {
#endif

#ifndef __JAMLIB_H__
#define __JAMLIB_H__

#include "core.h"

typedef struct _jamstate_t
{
    char *appname;
    corestate_t *cstate;
    pthread_t bgthread;
    callbacks_t *callbacks;
    simplequeue_t *queue;
    activitytable_t *atable;

} jamstate_t;


jamstate_t *jam_init();
bool jam_exit(jamstate_t *js);
void jam_event_loop(jamstate_t *js);
bool jam_core_ready(jamstate_t *js);
int jam_execute_func(jamstate_t *js, const char *fname, const char *fmt, ...);
void jam_reg_callback(jamstate_t *js, char *aname, eventtype_t etype,
                                                event_callback_f cb, void *data);
int jam_raise_event(jamstate_t *js, char *tag, eventtype_t etype,
                                                char *cback, char *fmt, ...);

#endif  /* __JAMLIB_H__ */

#ifdef __cplusplus
}
#endif
