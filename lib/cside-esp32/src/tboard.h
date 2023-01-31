#ifndef __TBOARD_H__
#define __TBOARD_H__

#include <stdint.h>
#include "task.h"

#define PRI_BATCH_TASK 1

typedef struct _function_t
{
    //TODO: fill in
    const char* name;    
    void (*fn_entry)(void);

} function_t;

typedef struct _tboard_t
{
    // TODO: fill in
    int32_t some_stuff;

    function_t funcs[256];
    uint32_t num_funcs;

} tboard_t;

function_t  function_create();

tboard_t*   tboard_create();
void        tboard_destroy();

void        tboard_register_func(tboard_t* tboard, function_t fn);
void        tboard_exec_func_from_name(tboard_t* tboard, const char* name);
void        _tboard_exec_func(tboard_t* tboard, function_t fn);

#define TBOARD_FUNC(x,y,z,w,f)  function_create()

#endif 