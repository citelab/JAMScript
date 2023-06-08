
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
                cbor_encode_text_stringz(&mapEncoder, u[i].val.sval);
            break;
            case D_INT_TYPE:
            case D_LONG_TYPE:
                cbor_encode_int(&mapEncoder, u[i].val.ival);
            break;
            case D_DOUBLE_TYPE:
                cbor_encode_double(&mapEncoder, u[i].val.dval);
            break;
            // TODO NVOID types &c..
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


int __extract_int(const uint8_t* buffer, size_t len)
{
    CborParser parser;
    CborValue value;
    int result;
    cbor_parser_init(buffer, len, 0, &parser, &value);
    cbor_value_get_int(&value, &result);
    return result;
}


double __extract_double(const uint8_t* buffer, size_t len)
{
    CborParser parser;
    CborValue value;
    double result;
    cbor_parser_init(buffer, len, 0, &parser, &value);
    cbor_value_get_double(&value, &result);
    return result;
}

char* __extract_str(const uint8_t* buffer, size_t len)
{
    CborParser parser;
    CborValue value;
    cbor_parser_init(buffer, len, 0, &parser, &value);
    size_t n, m;
    cbor_value_calculate_string_length(&value, &n);
    char* x = calloc(n+1, sizeof(char));
    cbor_value_copy_text_string(&value, x, &m, NULL);
    return x;
}

darg_entry_t* __extract_map(const uint8_t* buffer, size_t len)
{
    CborParser parser;
    CborValue value, map;
    cbor_parser_init(buffer, len, 0, &parser, &value);
    darg_entry_t* dargs = NULL,* darg;
    assert(cbor_value_is_map(&value));
    cbor_value_enter_container(&value, &map);
    while(!cbor_value_at_end(&map)){
        size_t n;
        assert(cbor_value_is_text_string(&map));
        cbor_value_calculate_string_length(&map, &n);
        char* field = calloc(n+1, sizeof(char));
        cbor_value_copy_text_string(&map, field, &n, &map);
        switch(cbor_value_get_type(&map)){
        case CborIntegerType:
            darg = (darg_entry_t*)malloc(sizeof(darg_entry_t));
            darg->type = D_INT_TYPE;
            cbor_value_get_int(&map, &darg->val.ival);
            cbor_value_advance(&map);
            break;
        case CborTextStringType:
            darg = (darg_entry_t*)malloc(sizeof(darg_entry_t));
            darg->type = D_STRING_TYPE;
            cbor_value_calculate_string_length(&map, &n);
            darg->val.sval = calloc(n+1, sizeof(char));
            cbor_value_copy_text_string(&map, darg->val.sval, &n, &map);
            break;
        case CborDoubleType:
            darg = (darg_entry_t*)malloc(sizeof(darg_entry_t));
            darg->type = D_DOUBLE_TYPE;
            cbor_value_get_double(&map, &darg->val.dval);
            cbor_value_advance(&map);
            break;
        default:
            printf("CBOR unknown type with key %s\n", field);
            free(field);
            cbor_value_advance(&map);
            continue;
        }
        darg->label = field;
        HASH_ADD_STR(dargs, label, darg); // do cbor maps have unique keys? anyways name analyzer should ensure
    }
    return dargs;
}
