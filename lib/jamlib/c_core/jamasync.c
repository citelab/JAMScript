
#include "jamlib.h"
#include "core.h"

#include <strings.h>
#include <pthread.h>


jactivity_t *jam_rexec_async(jamstate_t *js, char *aname, ...)
{
    va_list args;
    nvoid_t *nv;
    int i = 0;
    arg_t *qargs;

    // get the mask
    char *fmask = activity_get_mask(js->atable, aname);
    assert(fmask != NULL);
    
    if (strlen(fmask) > 0)
        qargs = (arg_t *)calloc(strlen(fmask), sizeof(arg_t));
    else
        qargs = NULL;
        
    printf("After mask \n");

    cbor_item_t *arr = cbor_new_indefinite_array();
    cbor_item_t *elem;

    va_start(args, aname);

    while(*fmask)
    {
        elem = NULL;
        switch(*fmask++)
        {
            case 'n':
                nv = va_arg(args, nvoid_t*);
                elem = cbor_build_bytestring(nv->data, nv->len);
                qargs[i].val.nval = nv;
                qargs[i].type = NVOID_TYPE;
                break;
            case 's':
                qargs[i].val.sval = strdup(va_arg(args, char *));
                qargs[i].type = STRING_TYPE;
                elem = cbor_build_string(qargs[i].val.sval);
                break;
            case 'i':
                qargs[i].val.ival = va_arg(args, int);
                qargs[i].type = INT_TYPE;
                elem = cbor_build_uint32(abs(qargs[i].val.ival));
                if (qargs[i].val.ival < 0)
                    cbor_mark_negint(elem);
                break;
            case 'd':
            case 'f':
                qargs[i].val.dval = va_arg(args, double);
                qargs[i].type = DOUBLE_TYPE;
                elem = cbor_build_float8(qargs[i].val.dval);
                break;
            default:
                break;
        }
        i++;
        if (elem != NULL)
            assert(cbor_array_push(arr, elem) == true);
    }
    va_end(args);

    printf("Blah 1\n");
    // Need to add start to activity_new()
    jactivity_t *jact = activity_new(js->atable, aname);
    printf("Blah 2\n");
    
    command_t *cmd = command_new_using_cbor("REXEC", "ASY", aname, "jact->actid", jact->actarg, arr, qargs, i);
    printf("Blah 3\n");
    
    temprecord_t *trec = jam_create_temprecord(js, jact, cmd);
    taskcreate(jam_rexec_run_wrapper, trec, STACKSIZE);
    printf("Blah 4\n");
    
    return jact;
}

temprecord_t *jam_create_temprecord(jamstate_t *js, jactivity_t *jact, command_t *cmd)
{
    temprecord_t *trec = (temprecord_t *)calloc(1, sizeof(temprecord_t));
    trec->jstate = js;
    trec->jact = jact;
    trec->cmd = cmd;

    return trec;
}

void jam_rexec_run_wrapper(void *arg)
{
    temprecord_t *trec = (temprecord_t *)arg;
    jam_sync_runner(trec->jstate, trec->jact, trec->cmd);
    free(trec);
}

