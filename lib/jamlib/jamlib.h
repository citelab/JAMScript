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

#ifndef __JAMLIB_H
#define __JAMLIB_H

#include "socket.h"
#include "event.h"
#include "callback.h"
#include "application.h"

extern Socket *jsocket;

int init_jam(char *jam_server, int port);
Application *open_application(char *appname);
int close_application(Application *app);
int remove_application(Application *app);
void print_application(Application *app);
int execute_remote_func(Application *app, const char *fname, const char *fmt, ...);
/* Register a callback method locally */
void register_callback(Application *app, char *aname, EventType etype, EventCallback cb, void *data);
void bg_event_loop(Application *app);

int raise_event(Application *app, char *tag, EventType etype, char *cback, char *fmt, ...);

#endif  // __JAMLIB_H

#ifdef __cplusplus
}
#endif
