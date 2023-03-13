#ifndef __RECEIVER_H__
#define __RECEIVER_H__
#include <lwip/api.h>

typedef struct _receiver_context_t
{

    struct netconn* conn;

} receiver_context_t;

// Must happen after cnode init.
void receiver_init();


#endif