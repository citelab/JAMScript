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

#ifndef __CONTEXT_H__
#define __CONTEXT_H__

#include <ucontext.h>


typedef struct _context_t
{
    ucontext_t uc;
} context_t;


#define context_save(ctx)               (void)getcontext(&(ctx)->uc)
#define context_restore(ctx)            (void)setcontext(&(ctx)->uc)
#define context_switch(old,new) \
                    (void)swapcontext(&((old)->uc), &((new)->uc))

void context_create(context_t *ctx,
                    void (*handler)(void *),
                    void *arg,
                    void *stack,
                    size_t stack_size)
{
    getcontext(&(ctx->uc));

    ctx->uc.uc_link            = NULL;
    ctx->uc.uc_stack.ss_sp     = stack;
    ctx->uc.uc_stack.ss_size   = stack_size;
    ctx->uc.uc_stack.ss_flags  = 0;

    makecontext(&(ctx->uc), handler, 1, arg);
    return;
}


#endif
