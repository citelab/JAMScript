#include "tboard.h"
#include <assert.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

function_t function_create() { return (function_t){0}; }

tboard_t *tboard_create()
{
    tboard_t *tboard = (tboard_t *)calloc(1, sizeof(tboard_t));

    tboard->num_funcs = 0;

    return tboard;
}

void tboard_destroy(tboard_t *tboard)
{
    assert(tboard != NULL);

    free(tboard);
}

void tboard_exec_func_from_name(tboard_t *tboard, const char *name)
{
    assert(tboard != NULL);

    for (int i = 0; i < tboard->num_funcs; i++)
    {
        function_t *fn = tboard->funcs + i;

        if (fn->fn_entry == NULL)
            continue;

        if (!strcmp(fn->name, name))
        {
            _tboard_exec_func(tboard, *fn);
        }
    }
}

void _tboard_exec_func(tboard_t *tboard, function_t fn)
{
    assert(tboard != NULL);

    // just directly run it for now..
    printf("Running function \"%s\"...\n", fn.name);
    fn.fn_entry();
}

void tboard_register_func(tboard_t *tboard, function_t fn)
{
    assert(tboard != NULL);

    tboard->funcs[tboard->num_funcs++] = fn;
}
