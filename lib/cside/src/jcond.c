#include "jcond.h"
#include "cnode.h"
#include "core.h"

#include <string.h>
#include <stdlib.h>

// functions for populating and storing jcond state at runtime...

void set_my_struct(jcond_my_t *my, void *cnode) {
    cnode_t *cn = (cnode_t *)cnode;
    memset(my, 0, sizeof(jcond_my_t));
    my->app = cn->args->appid;
    my->edge = cn->eservnum;
    my->id = cn->core->device_id;
    my->latitude = cn->latitude;
    my->longitude = cn->longitude;
    // my->type is set to 0 - MACHTYPE_DEVICE - always
}

void set_your_struct(jcond_your_t *your, void *data) {
    memset(your, 0, sizeof(jcond_your_t));
    if (data == NULL) return;
    // otherwise set the your data structure
    yourwrap_t *ywrap = (yourwrap_t *)data;
    cnode_t *c = (cnode_t *)ywrap->cnode;
    your->app = c->args->appid;
    your->side = 'J';
    your->edge = ywrap->edge;
    your->id = ywrap->id;
    your->latitude = ywrap->latitude;
    your->longitude = ywrap->longitude;
    your->type = ywrap->type;
}

yourwrap_t *create_yourwrap(void *cn, char *id, double latitude, double longitude, int edge, int type) {

    yourwrap_t *y = (yourwrap_t *)calloc(1, sizeof(yourwrap_t));
    y->id = strdup(id);
    y->latitude = latitude;
    y->longitude = longitude;
    y->edge = edge;
    y->type = type;
    y->cnode = cn;

    return y;
}
   
void free_yourwrap(yourwrap_t *y) {

    if (y->id != NULL)
        free(y->id);
    free(y);
}