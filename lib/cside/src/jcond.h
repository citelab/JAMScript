#ifndef __JCOND_H__
#define __JCOND_H__

enum machine_type {
    MACHTYPE_DEVICE = 0,
    MACHTYPE_FOG = 1,
    MACHTYPE_CLOUD = 2,
};

typedef struct {
    char* app;
    unsigned int edge;
    char* id;
    double latitude;
    double longitude;
    enum machine_type type;
} jcond_my_t;

typedef struct {
    char* app;
    unsigned int edge;
    char* id;
    double latitude;
    double longitude;
    enum machine_type type;
    char side;
} jcond_your_t;

typedef struct {
    char *id;
    double latitude;
    double longitude;
    int edge;
    int type;
    void *cnode;
} yourwrap_t;


void set_my_struct(jcond_my_t *my, void *cnode);
void set_your_struct(jcond_your_t *your, void *data);
yourwrap_t *create_yourwrap(void *cnode, char *id, double latitude, double longitude, int edge, int type);
void free_yourwrap(yourwrap_t *y);

#endif
