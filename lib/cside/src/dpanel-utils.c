
#include <tinycbor/cbor.h>
#include "dpanel.h"

#define MIN_VOID_SIZE               1024

int estimate_cbor_buffer_len(darg_t *u, int n)
{
    int len = 0;

    for (int i = 0; i < n; i++) {
        switch(u[i].type) {
            case D_NULL_TYPE:
                len += 1;
            break;
            case D_STRING_TYPE:
                len += sizeof(u[i].val.sval);
            break;
            case D_INT_TYPE:
                len += sizeof(u[i].val.ival);
            break;
            case D_LONG_TYPE:
                len += sizeof(u[i].val.lval);
            break;
            case D_DOUBLE_TYPE:
                len += sizeof(u[i].val.dval);
            break;
            case D_NVOID_TYPE:
                len += u[i].val.nval->len;
            break;
            case D_VOID_TYPE:
                len += MIN_VOID_SIZE;
            break;
        }

    }
    
    return len;
}

void do_cbor_encoding(CborEncoder *enc, darg_t *u, int n)
{
    CborEncoder mapEncoder;
    cbor_encoder_create_map(enc, &mapEncoder, n);

    for (int i = 0; i < n; i++) {
        cbor_encode_text_stringz(&mapEncoder, u[i].label);
        switch(u[i].type) {
            case D_STRING_TYPE:
                cbor_encode_byte_string(&mapEncoder, (uint8_t *)u[i].val.sval, sizeof(u[i].val.sval));
            break;
            case D_INT_TYPE:
            case D_LONG_TYPE:
                cbor_encode_int(&mapEncoder, u[i].val.ival);
            break;
            case D_DOUBLE_TYPE:
                cbor_encode_double(&mapEncoder, u[i].val.dval);
            break;
            default:
            break;
        }

    }
    cbor_encoder_close_container(enc, &mapEncoder);
}

void free_buffer(darg_t *u, int n)
{
    for (int i = 0; i < n; i++) {
        if (u[i].label != NULL)
            free(u[i].label);
        switch(u[i].type) {
            case D_STRING_TYPE:
                free(u[i].val.sval);
            break;
            case D_NVOID_TYPE:
                nvoid_free(u[i].val.nval);
            break;
            case D_VOID_TYPE:
                free(u[i].val.vval);
            break;
            default:
            break;
        }
    }
    free(u);
}