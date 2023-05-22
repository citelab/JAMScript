
#include <tinycbor/cbor.h>
#include "dpanel.h"

#define MIN_VOID_SIZE               1024

int estimate_cbor_buffer_len(uarg_t *u, int n)
{
    int len = 0;

    for (int i = 0; i < n; i++) {
        switch(u[i].type) {
            case U_NULL_TYPE:
                len += 1;
            break;
            case U_STRING_TYPE:
                len += sizeof(u[i].val.sval);
            break;
            case U_INT_TYPE:
                len += sizeof(u[i].val.ival);
            break;
            case U_LONG_TYPE:
                len += sizeof(u[i].val.lval);
            break;
            case U_DOUBLE_TYPE:
                len += sizeof(u[i].val.dval);
            break;
            case U_NVOID_TYPE:
                len += u[i].val.nval->len;
            break;
            case U_VOID_TYPE:
                len += MIN_VOID_SIZE;
            break;
        }

    }
    
    return len;
}

void do_cbor_encoding(CborEncoder *enc, uarg_t *u, int n)
{
    CborEncoder mapEncoder;
    cbor_encoder_create_map(enc, &mapEncoder, n);

    for (int i = 0; i < n; i++) {
        cbor_encode_text_stringz(&mapEncoder, u[i].label);
        switch(u[i].type) {
            case U_STRING_TYPE:
                cbor_encode_byte_string(&mapEncoder, u[i].val.sval, sizeof(u[i].val.sval));
            break;
            case U_INT_TYPE:
            case U_LONG_TYPE:
                cbor_encode_int(&mapEncoder, u[i].val.ival);
            break;
            case U_DOUBLE_TYPE:
                cbor_encode_double(&mapEncoder, u[i].val.dval);
            break;
            default:
            break;
        }

    }
    cbor_encoder_close_container(enc, &mapEncoder);
}

void free_buffer(uarg_t *u, int n)
{
    for (int i = 0; i < n; i++) {
        switch(u[i].type) {
            case U_STRING_TYPE:
                free(u[i].val.sval);
            break;
            case U_NVOID_TYPE:
                nvoid_free(u[i].val.nval);
            break;
            case U_VOID_TYPE:
                free(u[i].val.vval);
            break;
            default:
            break;
        }
    }
}