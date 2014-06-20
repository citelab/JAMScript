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

#define CEIL(X) ( (X - (int)X) > 0 ? (int)X+1 : (int)X )

#define TRUE	1
#define FALSE	0

#define CHUNKSIZE		1048576         /* 1Meg chunk size */
#define REG_CB_MSG_SIZE	        128		/* size of REG_CB string */

#define MAX_ARGS                16              /* Number of arguments for User defined functions */
#define MAX_BUF_SIZE            256             /* Buffer for user defined functions */


extern Socket *jsocket;

int init_jam(char *jam_server, int port);
int call_user_def(Application *app, char *fmt, ...);
int update(Application *app, char *varname, char *fmt, ...);

/* Get an event from remote server */
Event *get_event(Application *app);

/* Register a callback method locally */
void register_callback(Application *app, EventType etype, EventCallback cb, void *data);
void main_loop(Application *app);

#endif  // __JAMLIB_H

#ifdef __cplusplus
}
#endif
