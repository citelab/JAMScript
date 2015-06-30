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

#ifndef _EVENT_H
#define _EVENT_H

typedef enum EventType
{
    SetupEventType,
    PreLoad,
    Resize,
    ExposeEventType,
    ClickEventType,
    MouseDownEventType,
    MouseMoveEventType,
    MouseDragEventType,
    MouseDragOutEventType,
    KeyPressed,
    KeyReleased,
    KeyTyped,    /* KeyTyped responds like KeyPressed but ignores system keys (ctrl, alt, etc) */
    FileDropInit,
    FileDropChunkReceived,
    FileDropEnd,
    b64FileDropInit,            /* different events for base64 encoded transfers */
    b64FileDropChunkReceived,
    b64FileDropEnd,
    ButtonClickEventType
} EventType;


/**
 * Event Structures
 */
typedef struct MouseEvent
{
    int x;  /* X coordinate of click */
    int y;  /* Y coordinate of click */
    int button; /* mouse button clicked */
    int dx;    /* mouse movement deltas */    
    int dy;
} MouseEvent;

typedef struct KeyboardEvent
{
    /* Might want to add booleans for modifiers here? */
    int keycode;
} KeyboardEvent;

typedef struct DropEvent
{
    const char *name;    /* filename */
    const char *type;    /* filetype */
    unsigned int size;    /* filesize */
    unsigned int num_chunks; /* Number of transfer chunks */
    unsigned int chunk_size; /* current chunk size */
    unsigned int cur_chunk;    /*current chunk number */
    char *chunk; /* file chunk buffer */
} DropEvent;

typedef struct b64DropEvent
{
    const char *name;    /* filename */
    const char *type;    /* filetype */
    unsigned int o_size;    /* original filesize */
    unsigned int e_size;    /* encoded filesize ie total transfer size*/
    unsigned int num_chunks; /* Number of ENCODED transfer chunks */
    unsigned int chunk_size; /* current encoded chunk size */
    unsigned int cur_chunk;    /* current encoded chunk number */
    char *chunk; /* file chunk buffer */
} b64DropEvent;

typedef struct WinSize
{
    unsigned int width;
    unsigned int height;
} WinSize;

typedef struct ButtonClickEvent
{
    const char *id;
} ButtonClickEvent;


/**
 * General Event structure
 */
typedef struct Event
{
    EventType type;
    union {
        MouseEvent mouse;
        KeyboardEvent keyboard;
        DropEvent drop;
        b64DropEvent drop64;
        WinSize win;
        ButtonClickEvent button;
    } val;
} Event;

/** Event constructors */
void event_free(Event *e);
Event *event_expose_new();
Event *event_click_new(int x, int y, int button);
Event *event_mousedown_new(int x, int y, int button);
Event *event_mousemove_new(int x, int y, int dx, int dy);
Event *event_mousedrag_new(int x, int y, int dx, int dy, int button);
Event *event_mousedragout_new(int x, int y, int dx, int dy, int button);
Event *event_setup_new(int width, int height);
Event *event_preload_new();
Event *event_filedrop_init_new(const char *name, const char *type, unsigned int size, unsigned int num_chunks);
Event *event_filedrop_chunk_new(const char *name, const char *type, unsigned int size, unsigned int num_chunks, unsigned int chunk_size, unsigned int cur_chunk, char *filechunk);
Event *event_filedrop_end_new(const char *name, const char *type, unsigned int size, unsigned int num_chunks);
Event *event_filedrop64_init_new(const char *name, const char *type, unsigned int o_size);
Event *event_filedrop64_chunk_new(const char *name, const char *type, unsigned int o_size, unsigned int e_size, unsigned int num_chunks, unsigned int chunk_size, unsigned int cur_chunk, char *filechunk);
Event *event_filedrop64_end_new(const char *name, const char *type, unsigned int o_size, unsigned int e_size, unsigned int num_chunks);
Event *event_resize_new(int width, int height);
Event *event_key_typed_new(int keycode);
Event *event_key_pressed_new(int keycode);
Event *event_key_released_new(int keycode);
Event *event_buttonclick_new(const char *id);


#endif

#ifdef __cplusplus
}
#endif
