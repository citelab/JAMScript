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

void event_free(Event *e)
{
    if (e == NULL)
        return;
        
    free(e);
}


Event *event_expose_new()
{
    Event *e = NEW(Event);
    e->type = ExposeEventType;
    return e;
}

Event *event_setup_new(int width, int height)
{
    Event *e = NEW(Event);
    e->type = SetupEventType;

    e->val.win.width = width;
    e->val.win.height = height;
    return e;
}

Event *event_preload_new()
{
    Event *e = NEW(Event);
    e->type = PreLoad;

    return e;
}

Event *event_resize_new(int width, int height)
{
    Event *e = NEW(Event);
    e->type = Resize;

    e->val.win.width = width;
    e->val.win.height = height;

    return e;
}

Event *event_click_new(int x, int y, int button)
{
    Event *e = NEW(Event);
    e->type = ClickEventType;
    
    e->val.mouse.x = x;
    e->val.mouse.y = y;
    e->val.mouse.button = button;
    
    return e;
}

Event *event_mousedown_new(int x, int y, int button)
{
    Event *e = NEW(Event);
    e->type = MouseDownEventType;
    
    e->val.mouse.x = x;
    e->val.mouse.y = y;
    e->val.mouse.button = button;
    
    return e;
}

Event *event_mousemove_new(int x, int y, int dx, int dy)
{
    Event *e = NEW(Event);
    e->type = MouseMoveEventType;
    
    e->val.mouse.x = x;
    e->val.mouse.y = y;
    e->val.mouse.dx = dx;
    e->val.mouse.dy = dy;
    return e;
}

Event *event_mousedrag_new(int x, int y, int dx, int dy, int button)
{
    Event *e = NEW(Event);
    e->type = MouseDragEventType;
    
    e->val.mouse.x = x;
    e->val.mouse.y = y;
    e->val.mouse.dx = dx;
    e->val.mouse.dy = dy;
    e->val.mouse.button = button;
    return e;
}

Event *event_mousedragout_new(int x, int y, int dx, int dy, int button)
{
    Event *e = NEW(Event);
    e->type = MouseDragOutEventType;

    e->val.mouse.x = x;
    e->val.mouse.y = y;
    e->val.mouse.dx = dx;
    e->val.mouse.dy = dy;
    e->val.mouse.button = button;

    return e;
}

Event *event_filedrop_init_new(
		const char *name,
		const char *type,
		unsigned int size,
		unsigned int num_chunks) {
	Event *e = NEW(Event);
	e->type = FileDropInit;
	
	e->val.drop.name 		= strdup(name);
	e->val.drop.type 		= strdup(type);
	e->val.drop.size 		= size;
	e->val.drop.num_chunks 	= num_chunks;
	e->val.drop.cur_chunk 	= 0;
	return e;
}

Event *event_filedrop_chunk_new(
        const char *name,
        const char *type,
        unsigned int size,
        unsigned int num_chunks,
        unsigned int chunk_size,
        unsigned int cur_chunk,
        char *filechunk)
{
    Event *e = NEW(Event);
    e->type = FileDropChunkReceived;

    e->val.drop.name         = strdup(name);
    e->val.drop.type         = strdup(type);
    e->val.drop.size         = size;
    e->val.drop.num_chunks     = num_chunks;
    e->val.drop.chunk_size     = chunk_size;
    e->val.drop.cur_chunk     = cur_chunk;
    e->val.drop.chunk        = filechunk;
    return e;
}

Event *event_filedrop_end_new(
        const char *name,
        const char *type,
        unsigned int size,
        unsigned int num_chunks)
{
    Event *e = NEW(Event);
    e->type = FileDropEnd;

    e->val.drop.name         = strdup(name);
    e->val.drop.type         = strdup(type);
    e->val.drop.size         = size;
    e->val.drop.num_chunks     = num_chunks;
    return e;
}

Event *event_filedrop64_init_new(
        const char *name,
        const char *type,
        unsigned int o_size ) {
    Event *e = NEW(Event);
    e->type = b64FileDropInit;

    e->val.drop64.name         = strdup(name);
    e->val.drop64.type         = strdup(type);
    e->val.drop64.o_size    = o_size;

    return e;
}

Event *event_filedrop64_chunk_new(
        const char *name,
        const char *type,
        unsigned int o_size,
        unsigned int e_size,
        unsigned int num_chunks,
        unsigned int chunk_size,
        unsigned int cur_chunk,
        char *filechunk)
{
    Event *e = NEW(Event);
    e->type = b64FileDropChunkReceived;

    e->val.drop64.name         = strdup(name);
    e->val.drop64.type         = strdup(type);
    e->val.drop64.o_size         = o_size;
    e->val.drop64.e_size         = e_size;
    e->val.drop64.num_chunks     = num_chunks;
    e->val.drop64.chunk_size     = chunk_size;
    e->val.drop64.cur_chunk     = cur_chunk;
    e->val.drop64.chunk        = filechunk;
    return e;
}

Event *event_filedrop64_end_new(
        const char *name,
        const char *type,
        unsigned int o_size,
        unsigned int e_size,
        unsigned int num_chunks)
{
    Event *e = NEW(Event);
    e->type = b64FileDropEnd;

    e->val.drop64.name         = strdup(name);
    e->val.drop64.type         = strdup(type);
    e->val.drop64.o_size         = o_size;
    e->val.drop64.e_size         = e_size;
    e->val.drop64.num_chunks     = num_chunks;
    return e;
}

Event *event_key_typed_new(int keycode)
{
    Event *e = NEW(Event);
    e->type = KeyTyped;

    e->val.keyboard.keycode = keycode;

    return e;
}

Event *event_key_pressed_new(int keycode)
{
    Event *e = NEW(Event);
    e->type = KeyPressed;

    e->val.keyboard.keycode = keycode;

    return e;
}

Event *event_key_released_new(int keycode)
{
    Event *e = NEW(Event);
    e->type = KeyReleased;

    e->val.keyboard.keycode = keycode;

    return e;
}

Event *event_buttonclick_new(const char *id) {
    Event *e = NEW(Event);
    e->type = ButtonClickEventType;
    
    e->val.button.id         = strdup(id);
    return e;
}
